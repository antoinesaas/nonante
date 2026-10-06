-- V2 · Lectures (tableau de bord, classement, profils, portefeuille, escouades), facturation, admin, tâches planifiées.

-- ===========================================================================
-- Calendrier et classement
-- ===========================================================================
create function public._calendar(p_enrollment uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'day', d::date,
    'status', case
      when ds.status is not null then ds.status
      when e.status = 'draft' then 'future'
      when d::date = public.paris_today() then 'today'
      when d::date > public.paris_today() then 'future'
      else 'pending'
    end) order by d), '[]'::jsonb)
  from public.enrollments e
  cross join lateral generate_series(e.start_date::timestamp, e.end_date::timestamp, interval '1 day') d
  left join public.day_status ds on ds.enrollment_id = e.id and ds.day = d::date
  where e.id = p_enrollment;
$$;

-- Classement : Semaine (depuis lundi) ou Général (points cumulés), toutes escouades ou une seule.
create function public.leaderboard(p_period text default 'semaine', p_category text default null, p_squad uuid default null)
returns table (rank int, pseudo text, avatar_path text, level int, ovr int, category text, points int, streak int,
  is_me boolean, is_public boolean)
language sql stable security definer set search_path = '' as $$
  with allowed as (
    select p_squad is null or exists (
      select 1 from public.squads sq where sq.id = p_squad and (sq.is_public or sq.is_official or exists (
        select 1 from public.squad_members m where m.squad_id = sq.id and m.user_id = auth.uid()))
    ) as ok
  ),
  players as (
    select pr.id, pr.pseudo, pr.is_public, pr.avatar_path, ps.level, ps.ovr, ps.streak,
      (select en.category from public.enrollments en where en.user_id = pr.id and en.status <> 'draft'
        order by en.arc_number desc limit 1) as category
    from public.profiles pr
    join public.player_stats ps on ps.user_id = pr.id
    where exists (select 1 from public.enrollments en where en.user_id = pr.id and en.status <> 'draft')
      and (p_squad is null or exists (select 1 from public.squad_members m where m.squad_id = p_squad and m.user_id = pr.id))
      and (select ok from allowed)
  ),
  scored as (
    select pl.*, coalesce((select sum(l.delta) from public.points_ledger l where l.user_id = pl.id
      and (p_period <> 'semaine' or l.day >= public._week_monday(public.paris_today()))), 0)::int as points
    from players pl
    where p_category is null or pl.category = p_category
  )
  select (rank() over (order by s.points desc, s.streak desc, s.ovr desc))::int,
    case when s.is_public then s.pseudo else 'Anonyme' end,
    case when s.is_public then s.avatar_path end,
    s.level, s.ovr, s.category, s.points, s.streak,
    coalesce(s.id = auth.uid(), false),
    s.is_public
  from scored s
  order by 1, s.streak desc
  limit 500;
$$;

-- Chiffres réels, tous joueurs confondus.
create function public.global_stats()
returns table (joueurs int, arcs_en_cours int, verts_aujourdhui int, ont_lache int, arcs_tenus int)
language sql stable security definer set search_path = '' as $$
  select
    (select count(distinct user_id) from public.enrollments where status <> 'draft')::int,
    (select count(*) from public.enrollments e where e.status = 'active'
      and public.paris_today() between e.start_date and e.end_date)::int,
    (select count(*) from public.enrollments e
      where e.status = 'active' and public.paris_today() between e.start_date and e.end_date
        and exists (select 1 from public.principles pr where pr.enrollment_id = e.id
          and public._on_day(pr.active_from, pr.active_until, pr.days, public.paris_today()))
        and not exists (
          select 1 from public.principles pr
          where pr.enrollment_id = e.id and public._on_day(pr.active_from, pr.active_until, pr.days, public.paris_today())
            and not exists (select 1 from public.validations v
              where v.principle_id = pr.id and v.day = public.paris_today() and v.status <> 'rejected')
        ))::int,
    (select count(*) from public.enrollments where status = 'abandoned')::int,
    (select count(*) from public.enrollments where status = 'completed')::int;
$$;

create function public.achievement_rarity()
returns table (code text, title text, description text, points int, art_slug text, holders int, total int, percent int)
language sql stable security definer set search_path = '' as $$
  with t as (select count(distinct user_id)::int as total from public.enrollments where status <> 'draft')
  select a.code, a.title, a.description, a.points, a.art_slug,
    (select count(*) from public.user_achievements ua where ua.achievement_id = a.id)::int,
    t.total,
    case when t.total = 0 then 0
      else round(100.0 * (select count(*) from public.user_achievements ua where ua.achievement_id = a.id) / t.total)::int end
  from public.achievements a cross join t
  order by a.sort;
$$;

create function public._unlocked_arts(p_user uuid) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(au.slug order by au.slug), '{}')
  from public.art_unlocks au
  where au.unlock = 'base'
    or (au.unlock like 'level:%' and exists (
      select 1 from public.player_stats ps where ps.user_id = p_user and ps.level >= split_part(au.unlock, ':', 2)::int))
    or (au.unlock like 'achievement:%' and exists (
      select 1 from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
      where ua.user_id = p_user and a.code = split_part(au.unlock, ':', 2)));
$$;

create function public._stats_json(ps public.player_stats) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'xp', coalesce(ps.xp, 0), 'level', coalesce(ps.level, 1),
    'level_floor', 50 * power(coalesce(ps.level, 1) - 1, 2), 'level_next', 50 * power(coalesce(ps.level, 1), 2),
    'ovr', coalesce(ps.ovr, 0), 'discipline', coalesce(ps.discipline, 0), 'focus', coalesce(ps.focus, 0),
    'corps', coalesce(ps.corps, 0), 'business', coalesce(ps.business, 0), 'esprit', coalesce(ps.esprit, 0),
    'energie', coalesce(ps.energie, 0), 'streak', coalesce(ps.streak, 0), 'best_streak', coalesce(ps.best_streak, 0),
    'green_days', coalesce(ps.green_days, 0), 'focus_minutes', coalesce(ps.focus_minutes, 0), 'reps', coalesce(ps.reps, 0),
    'wakes', coalesce(ps.wakes, 0), 'arcs_completed', coalesce(ps.arcs_completed, 0),
    'wallet_proven_cents', coalesce(ps.wallet_proven_cents, 0), 'wallet_declared_cents', coalesce(ps.wallet_declared_cents, 0)
  );
$$;

create function public._plan_json(p_user uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'plan', public._plan(p_user),
    'paid_plan', pr.plan, 'interval', pr.plan_interval, 'status', pr.plan_status,
    'period_end', pr.current_period_end, 'cancel_at_period_end', pr.cancel_at_period_end,
    'comp_until', case when pr.comp_until >= public.paris_today() then pr.comp_until end,
    'limits', public._limits(public._plan(p_user))
  )
  from public.profiles pr where pr.id = p_user;
$$;

-- Plan de l'utilisateur connecté (page des plans, profil).
create function public.my_plan() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public._plan_json(auth.uid());
$$;

-- ===========================================================================
-- Tableau de bord : tout ce qu'il faut en un seul appel. Note aussi l'ouverture de l'app.
-- ===========================================================================
create function public.my_dashboard() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_today date := public.paris_today();
  prof public.profiles;
  e public.enrollments;
  ps public.player_stats;
  v_plan text;
  v_state text;
  v_principles jsonb;
  v_challenge jsonb;
  v_audits jsonb;
  v_running jsonb;
  v_rank int;
  v_total int;
  a public.challenge_assignments;
  ch public.challenges;
begin
  select * into prof from public.profiles where id = v_user;
  if prof.id is null then
    return jsonb_build_object('profile', null);
  end if;
  v_plan := public._plan(v_user);
  e := public._open_enrollment(v_user);
  if e.id is not null and e.status = 'draft' and v_plan is not null then
    perform public._activate_enrollment(e.id);
    e := public._open_enrollment(v_user);
  end if;
  if e.id is null then
    e := public._current_enrollment(v_user);
  end if;

  v_state := case
    when e.id is null then 'none'
    when e.status = 'draft' then 'draft'
    when e.status <> 'active' then 'ended'
    when v_today < e.start_date then 'before'
    when v_today > e.end_date then 'closing'
    when v_plan is null then 'locked'
    else 'running'
  end;

  if e.status = 'active' and v_today between e.start_date and e.end_date then
    insert into public.app_opens (enrollment_id, day) values (e.id, v_today) on conflict do nothing;
    if v_plan is not null then
      perform public._ensure_assignment(e.id);
    end if;
  end if;

  select * into ps from public.player_stats where user_id = v_user;
  if ps.user_id is null then
    perform public._refresh_stats(v_user);
    select * into ps from public.player_stats where user_id = v_user;
  end if;

  if e.id is not null and e.status <> 'draft' then
    select l.rank into v_rank from public.leaderboard('semaine', null, null) l where l.is_me;
    select count(*) into v_total from public.leaderboard('semaine', null, null);
  end if;

  if e.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'position', p.position, 'pillar', p.pillar, 'if_text', p.if_text, 'then_text', p.then_text,
      'proof_type', p.proof_type, 'difficulty', p.difficulty, 'value', 10 * p.difficulty, 'days', p.days,
      'target', p.target, 'why', p.why,
      'validation', (select jsonb_build_object('status', v.status, 'strength', v.strength, 'points', v.points,
          'proof_type', v.proof_type)
        from public.validations v where v.principle_id = p.id and v.day = v_today)
    ) order by p.position), '[]'::jsonb) into v_principles
    from public.principles p
    where p.enrollment_id = e.id
      and public._on_day(p.active_from, p.active_until, p.days, case when v_state in ('before', 'draft') then e.start_date else v_today end);

    select * into a from public.challenge_assignments
    where enrollment_id = e.id and week = public._arc_week(e.start_date, v_today);
    if a.id is not null then
      select * into ch from public.challenges where id = a.challenge_id;
      v_challenge := jsonb_build_object(
        'assignment_id', a.id, 'week', a.week, 'status', a.status, 'title', ch.title,
        'description', ch.description, 'kind', ch.kind, 'level', ch.level, 'proof_type', ch.proof_type,
        'rule', ch.rule, 'progress', public._assignment_progress(a.id),
        'points_done', public._challenge_points(ch, true), 'points_failed', public._challenge_points(ch, false)
      );
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', au.id, 'due_at', au.due_at, 'penalty', au.penalty,
      'label', coalesce(
        (select p.then_text from public.validations v join public.principles p on p.id = v.principle_id
          where v.id = au.validation_id),
        (select 'Revenu : ' || w.label from public.wallet_entries w where w.id = au.wallet_entry_id),
        (select ch2.title from public.challenge_proofs cp
          join public.challenge_assignments a2 on a2.id = cp.assignment_id
          join public.challenges ch2 on ch2.id = a2.challenge_id
          where cp.id = au.challenge_proof_id))
    ) order by au.due_at), '[]'::jsonb) into v_audits
    from public.audits au where au.user_id = v_user and au.status = 'open';
  end if;

  select jsonb_build_object('id', s.id, 'kind', s.kind, 'principle_id', s.principle_id,
    'assignment_id', s.challenge_assignment_id)
  into v_running
  from public.proof_sessions s where s.user_id = v_user and s.status = 'running' limit 1;

  return jsonb_build_object(
    'profile', jsonb_build_object('pseudo', prof.pseudo, 'avatar_path', prof.avatar_path, 'is_admin', prof.is_admin,
      'is_public', prof.is_public, 'referral_code', prof.referral_code),
    'plan', public._plan_json(v_user),
    'enrollment', case when e.id is null then null else jsonb_build_object(
      'id', e.id, 'status', e.status, 'arc_number', e.arc_number, 'start_date', e.start_date, 'end_date', e.end_date,
      'category', e.category, 'goal_type', e.goal_type, 'goal_title', e.goal_title, 'goal_target', e.goal_target,
      'goal_unit', e.goal_unit, 'jokers_used', e.jokers_used,
      'jokers_total', (public._limits(v_plan) ->> 'jokers')::int,
      'has_before_photo', e.before_photo_path is not null, 'has_after_photo', e.after_photo_path is not null) end,
    'state', v_state,
    'today', v_today,
    'day_number', case when e.id is not null and v_today between e.start_date and e.end_date then v_today - e.start_date + 1 end,
    'points', case when e.id is null then 0 else
      (select coalesce(sum(delta), 0) from public.points_ledger where enrollment_id = e.id) end,
    'week_points', (select coalesce(sum(delta), 0) from public.points_ledger
      where user_id = v_user and day >= public._week_monday(v_today)),
    'rank', v_rank,
    'total', v_total,
    'stats', public._stats_json(ps),
    'principles', coalesce(v_principles, '[]'::jsonb),
    'calendar', case when e.id is null then '[]'::jsonb else public._calendar(e.id) end,
    'challenge', v_challenge,
    'audits', coalesce(v_audits, '[]'::jsonb),
    'running_session', v_running,
    'joker_today', e.id is not null and exists (select 1 from public.joker_days j where j.enrollment_id = e.id and j.day = v_today),
    'wallet_month_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_entries
      where user_id = v_user and status <> 'rejected' and day >= date_trunc('month', v_today)::date),
    'unseen_achievements', (select count(*) from public.user_achievements ua where ua.user_id = v_user and ua.seen_at is null),
    'level_up', coalesce(ps.level > ps.level_seen, false)
  );
end;
$$;

-- Détail d'un jour du calendrier.
create function public.day_detail(p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._current_enrollment(v_user);
begin
  if e.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'day', p_day,
    'status', (select status from public.day_status where enrollment_id = e.id and day = p_day),
    'joker', exists (select 1 from public.joker_days where enrollment_id = e.id and day = p_day),
    'points', (select coalesce(sum(delta), 0) from public.points_ledger where enrollment_id = e.id and day = p_day),
    'principles', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'then_text', p.then_text, 'proof_type', p.proof_type, 'pillar', p.pillar,
        'validation', (select jsonb_build_object('status', v.status, 'strength', v.strength, 'points', v.points)
          from public.validations v where v.principle_id = p.id and v.day = p_day),
        'miss', (select jsonb_build_object('points', m.points, 'streak', m.streak, 'white', m.white)
          from public.misses m where m.principle_id = p.id and m.day = p_day)
      ) order by p.position), '[]'::jsonb)
      from public.principles p
      where p.enrollment_id = e.id and public._on_day(p.active_from, p.active_until, p.days, p_day)
    )
  );
end;
$$;

-- Onglet Principes : la version qui s'applique au prochain jour modifiable, et la bibliothèque.
create function public.my_principles() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._open_enrollment(v_user);
  v_eff date;
  v_plan text := public._plan(v_user);
begin
  if e.id is null then
    e := public._current_enrollment(v_user);
  end if;
  if e.id is null then
    return jsonb_build_object('enrollment', null);
  end if;
  v_eff := case when e.status in ('draft', 'active') then public._effective_day(e) else e.end_date end;
  return jsonb_build_object(
    'enrollment', jsonb_build_object('id', e.id, 'status', e.status, 'start_date', e.start_date, 'end_date', e.end_date,
      'goal_type', e.goal_type, 'goal_title', e.goal_title, 'category', e.category),
    'editable', e.status in ('draft', 'active') and v_eff <= e.end_date,
    'started', e.status = 'active' and public.paris_today() >= e.start_date,
    'effective_day', v_eff,
    'plan', v_plan,
    'limits', public._limits(v_plan),
    'principles', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'position', p.position, 'pillar', p.pillar, 'if_text', p.if_text, 'then_text', p.then_text,
        'proof_type', p.proof_type, 'difficulty', p.difficulty, 'value', 10 * p.difficulty, 'days', p.days,
        'target', p.target, 'why', p.why, 'source', p.source, 'template_code', p.template_code,
        'pending', p.active_from > public.paris_today() and e.status = 'active' and public.paris_today() >= e.start_date
      ) order by p.position), '[]'::jsonb)
      from public.principles p
      where p.enrollment_id = e.id and p.active_from <= v_eff and (p.active_until is null or p.active_until >= v_eff)
    ),
    'templates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', t.code, 'pillar', t.pillar, 'if_text', t.if_text, 'then_text', t.then_text, 'proof_type', t.proof_type,
        'difficulty', t.difficulty, 'days', t.days, 'target', t.target, 'why', t.why, 'source', t.source,
        'recommended', e.goal_type = any(t.goal_types)
          or exists (select 1 from unnest(t.weak_points) w where w = any(e.weak_points))
      ) order by t.pillar, t.sort), '[]'::jsonb)
      from public.principle_templates t
    )
  );
end;
$$;

-- ===========================================================================
-- Profils
-- ===========================================================================
create function public.public_profile(p_pseudo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  prof public.profiles;
  e public.enrollments;
  ps public.player_stats;
  v_rank int;
  v_total_points int;
begin
  select * into prof from public.profiles where pseudo = lower(btrim(coalesce(p_pseudo, ''))) and is_public;
  if prof.id is null then
    return null;
  end if;
  select en.* into e from public.enrollments en
  where en.user_id = prof.id and en.status <> 'draft' order by en.arc_number desc limit 1;
  select * into ps from public.player_stats where user_id = prof.id;
  select coalesce(sum(delta), 0) into v_total_points from public.points_ledger where user_id = prof.id;
  select l.rank into v_rank from public.leaderboard('total', null, null) l where l.pseudo = prof.pseudo;
  return jsonb_build_object(
    'pseudo', prof.pseudo,
    'avatar_path', prof.avatar_path,
    'bio', prof.bio,
    'art', coalesce(prof.profile_art_slug, 'nuit-tours'),
    'founder', prof.plan = 'fondateur' and prof.plan_status = 'lifetime',
    'refused_proofs', prof.refused_proofs,
    'member_since', prof.created_at,
    'stats', public._stats_json(ps),
    'wallet_proven_cents', case when prof.wallet_public then coalesce(ps.wallet_proven_cents, 0) end,
    'arc', case when e.id is null then null else jsonb_build_object(
      'number', e.arc_number, 'status', e.status, 'category', e.category, 'goal_type', e.goal_type,
      'goal', case when e.goal_public then e.goal_title end,
      'day_number', case when public.paris_today() between e.start_date and e.end_date
        then public.paris_today() - e.start_date + 1 end) end,
    'points', v_total_points,
    'rank', v_rank,
    'calendar', case when e.id is not null then public._calendar(e.id) else '[]'::jsonb end,
    'achievements', (
      select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'title', a.title, 'description', a.description,
        'art_slug', a.art_slug, 'unlocked_at', ua.unlocked_at) order by a.sort), '[]'::jsonb)
      from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
      where ua.user_id = prof.id
    )
  );
end;
$$;

create function public.my_profile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  prof public.profiles;
  ps public.player_stats;
begin
  select * into prof from public.profiles where id = v_user;
  if prof.id is null then
    return null;
  end if;
  perform public._refresh_stats(v_user);
  select * into ps from public.player_stats where user_id = v_user;
  return jsonb_build_object(
    'pseudo', prof.pseudo,
    'email', (select u.email from auth.users u where u.id = v_user),
    'avatar_path', prof.avatar_path,
    'bio', prof.bio,
    'is_public', prof.is_public,
    'is_admin', prof.is_admin,
    'email_reminders', prof.email_reminders,
    'wallet_public', prof.wallet_public,
    'profile_art_slug', coalesce(prof.profile_art_slug, 'nuit-tours'),
    'refused_proofs', prof.refused_proofs,
    'referral_code', prof.referral_code,
    'referral_ready', prof.stripe_promotion_code_id is not null,
    'referral_sales', (select count(*) from public.referrals r where r.referrer_id = v_user),
    'referral_credit_cents', (select coalesce(sum(reward_cents), 0) from public.referrals r where r.referrer_id = v_user),
    'has_billing', prof.stripe_customer_id is not null,
    'plan', public._plan_json(v_user),
    'stats', public._stats_json(ps),
    'points', (select coalesce(sum(delta), 0) from public.points_ledger where user_id = v_user),
    'rank', (select l.rank from public.leaderboard('total', null, null) l where l.is_me),
    'arts', to_jsonb(public._unlocked_arts(v_user)),
    'push_subscriptions', (select count(*) from public.push_subscriptions s where s.user_id = v_user),
    'arcs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'number', e.arc_number, 'status', e.status, 'start_date', e.start_date, 'end_date', e.end_date,
        'goal_title', e.goal_title,
        'green', (select count(*) from public.day_status d where d.enrollment_id = e.id and d.status = 'green'),
        'points', (select coalesce(sum(delta), 0) from public.points_ledger l where l.enrollment_id = e.id),
        'loyalty_applied', e.loyalty_applied_at is not null
      ) order by e.arc_number desc), '[]'::jsonb)
      from public.enrollments e where e.user_id = v_user
    ),
    'achievements', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', a.code, 'title', a.title, 'description', a.description, 'points', a.points, 'art_slug', a.art_slug,
        'unlocked_at', ua.unlocked_at,
        'percent', (select r.percent from public.achievement_rarity() r where r.code = a.code)
      ) order by a.sort), '[]'::jsonb)
      from public.achievements a
      left join public.user_achievements ua on ua.achievement_id = a.id and ua.user_id = v_user
    )
  );
end;
$$;

create function public.update_profile_settings(
  p_is_public boolean,
  p_art_slug text,
  p_email_reminders boolean,
  p_wallet_public boolean,
  p_bio text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_bio text := nullif(regexp_replace(btrim(coalesce(p_bio, '')), '\s+', ' ', 'g'), '');
begin
  if p_art_slug is not null and not (p_art_slug = any(public._unlocked_arts(v_user))) then
    raise exception 'Ce fond n''est pas encore débloqué.';
  end if;
  if length(coalesce(v_bio, '')) > 140 then
    raise exception 'Bio : 140 caractères au plus.';
  end if;
  update public.profiles
  set is_public = coalesce(p_is_public, is_public),
      profile_art_slug = coalesce(p_art_slug, profile_art_slug),
      email_reminders = coalesce(p_email_reminders, email_reminders),
      wallet_public = coalesce(p_wallet_public, wallet_public),
      bio = case when p_bio is null then bio else v_bio end
  where id = v_user;
  if not found then
    raise exception 'Profil introuvable.';
  end if;
end;
$$;

-- Photo de profil déposée par le serveur (ré-encodée). Renvoie l'ancienne à supprimer.
create function public.set_avatar(p_user uuid, p_path text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_old text;
begin
  if p_path is not null and (p_path !~ ('^' || p_user::text || '/[0-9a-f-]{36}\.webp$') or not exists (
    select 1 from storage.objects o where o.bucket_id = 'avatars' and o.name = p_path
  )) then
    raise exception 'Photo introuvable.';
  end if;
  select avatar_path into v_old from public.profiles where id = p_user;
  update public.profiles set avatar_path = p_path where id = p_user;
  return v_old;
end;
$$;

create function public.new_achievements() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'title', a.title, 'description', a.description,
    'points', a.points, 'art_slug', a.art_slug) order by ua.unlocked_at), '[]'::jsonb)
  from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
  where ua.user_id = auth.uid() and ua.seen_at is null;
$$;

create function public.mark_achievements_seen() returns void
language sql security definer set search_path = '' as $$
  update public.user_achievements set seen_at = now() where user_id = auth.uid() and seen_at is null;
$$;

create function public.mark_level_seen() returns void
language sql security definer set search_path = '' as $$
  update public.player_stats set level_seen = level where user_id = auth.uid() and level_seen <> level;
$$;

-- ===========================================================================
-- Portefeuille et photo avant / après
-- ===========================================================================
create function public.my_wallet() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_today date := public.paris_today();
  e public.enrollments := public._current_enrollment(v_user);
begin
  return jsonb_build_object(
    'enabled', coalesce((public._limits(public._plan(v_user)) ->> 'wallet')::boolean, false),
    'proven_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_entries
      where user_id = v_user and status in ('proven', 'audit_pending')),
    'declared_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_entries
      where user_id = v_user and status = 'declared'),
    'month_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_entries
      where user_id = v_user and status <> 'rejected' and day >= date_trunc('month', v_today)::date),
    'arc_cents', case when e.id is null then 0 else (select coalesce(sum(amount_cents), 0) from public.wallet_entries
      where user_id = v_user and status <> 'rejected' and day between e.start_date and e.end_date) end,
    'xp_today', exists (select 1 from public.points_ledger where user_id = v_user and reason = 'wallet' and day = v_today),
    'goal', case when e.id is not null and e.goal_type = 'revenu' then jsonb_build_object(
      'title', e.goal_title, 'target', e.goal_target, 'unit', e.goal_unit) end,
    'months', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'proven_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_entries w
          where w.user_id = v_user and w.status in ('proven', 'audit_pending') and date_trunc('month', w.day) = m),
        'declared_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_entries w
          where w.user_id = v_user and w.status = 'declared' and date_trunc('month', w.day) = m)
      ) order by m), '[]'::jsonb)
      from generate_series(date_trunc('month', v_today) - interval '5 months', date_trunc('month', v_today), interval '1 month') m
    ),
    'entries', (
      select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'day', w.day, 'amount_cents', w.amount_cents,
        'source', w.source, 'label', w.label, 'status', w.status, 'has_proof', w.proof_path is not null)
        order by w.day desc, w.created_at desc), '[]'::jsonb)
      from (select * from public.wallet_entries where user_id = v_user order by day desc, created_at desc limit 100) w
    )
  );
end;
$$;

create function public.my_arc_photos() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._current_enrollment(v_user);
begin
  if e.id is null or e.status = 'draft' then
    return null;
  end if;
  return jsonb_build_object(
    'before_path', e.before_photo_path,
    'after_path', e.after_photo_path,
    'day_number', case when public.paris_today() between e.start_date and e.end_date
      then public.paris_today() - e.start_date + 1 end,
    'can_take_before', e.status = 'active' and (e.before_photo_path is null or public.paris_today() <= e.start_date + 6),
    'can_take_after', e.status <> 'active' or public.paris_today() >= e.start_date + 80
  );
end;
$$;

-- Photo avant (première semaine) ou après (à partir du jour 81). Renvoie l'ancienne à supprimer.
create function public.set_arc_photo(p_user uuid, p_which text, p_path text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  e public.enrollments := public._current_enrollment(p_user);
  v_old text;
begin
  perform public._check_proof_file(p_user, p_path);
  if e.id is null or e.status = 'draft' then
    raise exception 'Lance ton arc d''abord.';
  end if;
  if p_which = 'avant' then
    if e.status <> 'active' or (e.before_photo_path is not null and public.paris_today() > e.start_date + 6) then
      raise exception 'La photo avant se prend pendant la première semaine.';
    end if;
    v_old := e.before_photo_path;
    update public.enrollments set before_photo_path = p_path where id = e.id;
  elsif p_which = 'apres' then
    if e.status = 'active' and public.paris_today() < e.start_date + 80 then
      raise exception 'La photo après se prend à partir du jour 81.';
    end if;
    v_old := e.after_photo_path;
    update public.enrollments set after_photo_path = p_path where id = e.id;
  else
    raise exception 'Photo inconnue.';
  end if;
  return v_old;
end;
$$;

-- ===========================================================================
-- Escouades
-- ===========================================================================
create function public._squad_json(sq public.squads, p_user uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', sq.id, 'name', sq.name, 'description', sq.description, 'is_public', sq.is_public,
    'is_official', sq.is_official, 'start_date', sq.start_date,
    'members', (select count(*) from public.squad_members m where m.squad_id = sq.id),
    'is_member', exists (select 1 from public.squad_members m where m.squad_id = sq.id and m.user_id = p_user),
    'is_owner', sq.owner_id is not distinct from p_user and p_user is not null,
    'code', case when exists (select 1 from public.squad_members m where m.squad_id = sq.id and m.user_id = p_user)
      then sq.code end
  );
$$;

create function public._join_squad(p_user uuid, sq public.squads) returns void
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.squad_members where squad_id = sq.id and user_id = p_user) then
    return;
  end if;
  if (select count(*) from public.squad_members where squad_id = sq.id) >= 50 then
    raise exception 'Escouade complète (50 membres).';
  end if;
  if (select count(*) from public.squad_members where user_id = p_user) >= 3 then
    raise exception 'Tu fais déjà partie de 3 escouades.';
  end if;
  insert into public.squad_members (squad_id, user_id) values (sq.id, p_user);
  perform public._after_change(p_user);
end;
$$;

create function public.create_squad(p_name text, p_description text, p_is_public boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_desc text := nullif(regexp_replace(btrim(coalesce(p_description, '')), '\s+', ' ', 'g'), '');
  v_code text;
  sq public.squads;
begin
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Crée ton profil d''abord.';
  end if;
  if not coalesce((public._limits(public._plan(v_user)) ->> 'create_squad')::boolean, false) then
    raise exception 'Créer une escouade fait partie du plan Pro.';
  end if;
  if length(v_name) < 3 or length(v_name) > 40 then
    raise exception 'Nom : de 3 à 40 caractères.';
  end if;
  if length(coalesce(v_desc, '')) > 160 then
    raise exception 'Description : 160 caractères au plus.';
  end if;
  if (select count(*) from public.squads where owner_id = v_user and not is_official) >= 3 then
    raise exception 'Tu as déjà créé 3 escouades.';
  end if;
  if (select count(*) from public.squad_members where user_id = v_user) >= 3 then
    raise exception 'Tu fais déjà partie de 3 escouades.';
  end if;
  loop
    v_code := public._squad_code();
    exit when not exists (select 1 from public.squads where code = v_code);
  end loop;
  insert into public.squads (name, description, code, owner_id, is_public)
  values (v_name, v_desc, v_code, v_user, coalesce(p_is_public, false))
  returning * into sq;
  perform public._join_squad(v_user, sq);
  return v_code;
end;
$$;

create function public.join_squad(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  sq public.squads;
begin
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Crée ton profil d''abord.';
  end if;
  select * into sq from public.squads where code = upper(btrim(coalesce(p_code, '')));
  if sq.id is null then
    raise exception 'Code d''escouade inconnu.';
  end if;
  perform public._join_squad(v_user, sq);
  return sq.id;
end;
$$;

create function public.join_public_squad(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  sq public.squads;
begin
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Crée ton profil d''abord.';
  end if;
  select * into sq from public.squads where id = p_id and (is_public or is_official);
  if sq.id is null then
    raise exception 'Escouade introuvable.';
  end if;
  perform public._join_squad(v_user, sq);
end;
$$;

create function public.leave_squad(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  sq public.squads;
  v_next uuid;
begin
  delete from public.squad_members where squad_id = p_id and user_id = v_user;
  if not found then
    raise exception 'Tu ne fais pas partie de cette escouade.';
  end if;
  select * into sq from public.squads where id = p_id;
  if sq.owner_id = v_user then
    select user_id into v_next from public.squad_members where squad_id = p_id order by joined_at limit 1;
    if v_next is not null then
      update public.squads set owner_id = v_next where id = p_id;
    elsif not sq.is_official then
      delete from public.squads where id = p_id;
    else
      update public.squads set owner_id = null where id = p_id;
    end if;
  end if;
end;
$$;

create function public.my_squads() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(public._squad_json(sq, auth.uid()) order by sq.is_official desc, m.joined_at), '[]'::jsonb)
  from public.squad_members m join public.squads sq on sq.id = m.squad_id
  where m.user_id = auth.uid();
$$;

create function public.public_squads() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.official desc, x.members desc), '[]'::jsonb)
  from (
    select public._squad_json(sq, auth.uid()) as j, sq.is_official as official,
      (select count(*) from public.squad_members m where m.squad_id = sq.id) as members
    from public.squads sq
    where (sq.is_public or sq.is_official) and (sq.start_date is null or sq.start_date >= public.paris_today() - 89)
    limit 50
  ) x;
$$;

-- Départs collectifs encore ouverts (proposés à l'onboarding).
create function public.collective_starts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', sq.id, 'name', sq.name, 'start_date', sq.start_date,
    'members', (select count(*) from public.squad_members m where m.squad_id = sq.id)) order by sq.start_date), '[]'::jsonb)
  from public.squads sq
  where sq.is_official and sq.start_date is not null and sq.start_date >= public.paris_today();
$$;

create function public.squad_detail(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public._squad_json(sq, auth.uid())
  from public.squads sq
  where sq.id = p_id and (sq.is_public or sq.is_official
    or exists (select 1 from public.squad_members m where m.squad_id = sq.id and m.user_id = auth.uid()));
$$;

-- ===========================================================================
-- Réglages, notifications, signalements, RGPD
-- ===========================================================================
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
begin
  if (select count(*) from public.push_subscriptions where user_id = v_user) >= 5 then
    delete from public.push_subscriptions where id = (
      select id from public.push_subscriptions where user_id = v_user order by created_at limit 1);
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_user, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

create function public.delete_push_subscriptions() returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where user_id = auth.uid();
$$;

create function public.report_user(p_pseudo text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_target uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Crée ton profil pour signaler quelqu''un.';
  end if;
  select id into v_target from public.profiles where pseudo = lower(btrim(coalesce(p_pseudo, ''))) and is_public;
  if v_target is null then
    raise exception 'Profil introuvable.';
  end if;
  if v_target = v_user then
    raise exception 'Tu ne peux pas te signaler toi-même.';
  end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'Explique en quelques mots (3 à 500 caractères).';
  end if;
  if (select count(*) from public.reports where reporter_id = v_user and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Trop de signalements aujourd''hui.';
  end if;
  insert into public.reports (reporter_id, reported_user_id, reason) values (v_user, v_target, v_reason);
end;
$$;

create function public.export_my_data() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
begin
  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('email', u.email, 'created_at', u.created_at) from auth.users u where u.id = v_user),
    'profile', (select to_jsonb(p) - 'stripe_promotion_code_id' - 'stripe_customer_id' - 'stripe_subscription_id'
      from public.profiles p where p.id = v_user),
    'player_stats', (select to_jsonb(s) from public.player_stats s where s.user_id = v_user),
    'arcs', (select coalesce(jsonb_agg(to_jsonb(e)), '[]') from public.enrollments e where e.user_id = v_user),
    'principles', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.principles p
      join public.enrollments e on e.id = p.enrollment_id where e.user_id = v_user),
    'validations', (select coalesce(jsonb_agg(to_jsonb(v)), '[]') from public.validations v
      join public.enrollments e on e.id = v.enrollment_id where e.user_id = v_user),
    'proof_sessions', (select coalesce(jsonb_agg(to_jsonb(s) - 'nonce' - 'data'), '[]')
      from public.proof_sessions s where s.user_id = v_user),
    'points_ledger', (select coalesce(jsonb_agg(to_jsonb(l)), '[]') from public.points_ledger l where l.user_id = v_user),
    'day_status', (select coalesce(jsonb_agg(to_jsonb(d)), '[]') from public.day_status d
      join public.enrollments e on e.id = d.enrollment_id where e.user_id = v_user),
    'jokers', (select coalesce(jsonb_agg(to_jsonb(j)), '[]') from public.joker_days j
      join public.enrollments e on e.id = j.enrollment_id where e.user_id = v_user),
    'wallet', (select coalesce(jsonb_agg(to_jsonb(w)), '[]') from public.wallet_entries w where w.user_id = v_user),
    'audits', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.audits a where a.user_id = v_user),
    'achievements', (select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'unlocked_at', ua.unlocked_at)), '[]')
      from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where ua.user_id = v_user),
    'squads', (select coalesce(jsonb_agg(jsonb_build_object('name', sq.name, 'joined_at', m.joined_at)), '[]')
      from public.squad_members m join public.squads sq on sq.id = m.squad_id where m.user_id = v_user),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('plan', p.plan, 'amount_cents', p.amount_cents, 'paid_at', p.paid_at)), '[]')
      from public.payments p where p.user_id = v_user),
    'reports_filed', (select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'created_at', r.created_at)), '[]')
      from public.reports r where r.reporter_id = v_user)
  );
end;
$$;

-- Suppression de compte (RGPD). Les paiements restent (obligation comptable), détachés du compte.
-- Renvoie les fichiers à supprimer du stockage : {"proofs": [...], "avatars": [...]}.
create function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_email text := lower((select u.email from auth.users u where u.id = v_user));
  v_files jsonb;
begin
  select jsonb_build_object(
    'proofs', coalesce((select jsonb_agg(o.name) from storage.objects o where o.bucket_id = 'proofs' and o.name like v_user::text || '/%'), '[]'),
    'avatars', coalesce((select jsonb_agg(o.name) from storage.objects o where o.bucket_id = 'avatars' and o.name like v_user::text || '/%'), '[]')
  ) into v_files;
  perform set_config('nonante.account_deletion', 'on', true);
  delete from public.points_ledger where user_id = v_user;
  delete from public.profiles where id = v_user;
  delete from public.waitlist where email = v_email;
  return v_files;
end;
$$;

-- ===========================================================================
-- Facturation (serveur uniquement, clé service_role)
-- ===========================================================================
create function public.plans_public() returns jsonb
language sql stable security definer set search_path = '' as $$
  with s as (select value as v from public.settings where key = 'plans')
  select jsonb_build_object(
    'essentiel', jsonb_build_object('month', (s.v #> '{essentiel,month,amount}'), 'year', (s.v #> '{essentiel,year,amount}')),
    'pro', jsonb_build_object('month', (s.v #> '{pro,month,amount}'), 'year', (s.v #> '{pro,year,amount}')),
    'fondateur', jsonb_build_object('lifetime', (s.v #> '{fondateur,lifetime,amount}'),
      'limit', (s.v #> '{fondateur,limit}'),
      'sold', (select count(*) from public.profiles where plan = 'fondateur' and plan_status = 'lifetime'))
  )
  from s;
$$;

create function public.plan_price(p_plan text, p_interval text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select (select value from public.settings where key = 'plans') -> p_plan -> p_interval;
$$;

create function public.billing_profile(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'email', (select u.email from auth.users u where u.id = p.id),
    'pseudo', p.pseudo, 'stripe_customer_id', p.stripe_customer_id, 'stripe_subscription_id', p.stripe_subscription_id,
    'plan', p.plan, 'plan_status', p.plan_status, 'effective_plan', public._plan(p.id),
    'referral_code', p.referral_code, 'stripe_promotion_code_id', p.stripe_promotion_code_id,
    'utm_source', p.utm_source, 'utm_campaign', p.utm_campaign,
    'has_draft', exists (select 1 from public.enrollments e where e.user_id = p.id and e.status = 'draft'),
    'principles_count', (select public._principles_count_at(e.id, e.start_date) from public.enrollments e
      where e.user_id = p.id and e.status in ('draft', 'active') limit 1)
  )
  from public.profiles p where p.id = p_user;
$$;

create function public.set_stripe_customer(p_user uuid, p_customer text) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set stripe_customer_id = p_customer where id = p_user and stripe_customer_id is null;
$$;

create function public.set_referral_promo(p_user uuid, p_promotion_code_id text) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set stripe_promotion_code_id = p_promotion_code_id
  where id = p_user and stripe_promotion_code_id is null;
$$;

-- Abonnement créé, modifié ou résilié (webhook). Renvoie l'utilisateur concerné.
create function public.sync_subscription(
  p_user uuid,
  p_customer text,
  p_subscription text,
  p_plan text,
  p_interval text,
  p_status text,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  prof public.profiles;
  e public.enrollments;
begin
  select * into prof from public.profiles
  where (p_user is not null and id = p_user) or (p_user is null and stripe_customer_id = p_customer)
  limit 1;
  if prof.id is null then
    return null;
  end if;
  -- Fondateur : l'accès à vie ne dépend d'aucun abonnement.
  if prof.plan = 'fondateur' and prof.plan_status = 'lifetime' then
    return prof.id;
  end if;
  -- Événement d'un ancien abonnement alors qu'un autre est actif : ignoré.
  if prof.stripe_subscription_id is not null and prof.stripe_subscription_id <> p_subscription
    and prof.plan_status in ('active', 'trialing', 'past_due') and p_status not in ('active', 'trialing') then
    return prof.id;
  end if;
  update public.profiles
  set stripe_customer_id = coalesce(stripe_customer_id, p_customer),
      stripe_subscription_id = p_subscription,
      plan = case when p_plan in ('essentiel', 'pro') then p_plan else plan end,
      plan_interval = case when p_interval in ('month', 'year') then p_interval else plan_interval end,
      plan_status = left(p_status, 30),
      current_period_end = p_period_end,
      cancel_at_period_end = coalesce(p_cancel_at_period_end, false)
  where id = prof.id;
  e := public._open_enrollment(prof.id);
  if e.id is not null then
    perform public._activate_enrollment(e.id);
  end if;
  return prof.id;
end;
$$;

create function public.grant_lifetime(p_user uuid, p_customer text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.enrollments;
begin
  update public.profiles
  set plan = 'fondateur', plan_interval = 'lifetime', plan_status = 'lifetime',
      stripe_customer_id = coalesce(stripe_customer_id, p_customer)
  where id = p_user;
  e := public._open_enrollment(p_user);
  if e.id is not null then
    perform public._activate_enrollment(e.id);
  end if;
end;
$$;

create function public.record_payment(
  p_object_id text,
  p_user uuid,
  p_kind text,
  p_plan text,
  p_interval text,
  p_amount int,
  p_currency text
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.payments (user_id, stripe_object_id, kind, plan, plan_interval, amount_cents, currency, utm_source, utm_campaign)
  select p_user, p_object_id, p_kind, p_plan, p_interval, greatest(coalesce(p_amount, 0), 0), coalesce(p_currency, 'eur'),
    pr.utm_source, pr.utm_campaign
  from (select 1) x left join public.profiles pr on pr.id = p_user
  on conflict (stripe_object_id) do nothing;
  return found;
end;
$$;

-- Vente parrainée : renvoie le parrain (et son client Stripe pour le crédit) si c'est une nouvelle vente.
create function public.record_referral(p_promotion_code_id text, p_referred uuid, p_object_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_referrer public.profiles;
begin
  select * into v_referrer from public.profiles where stripe_promotion_code_id = p_promotion_code_id;
  if v_referrer.id is null or v_referrer.id = p_referred then
    return null;
  end if;
  insert into public.referrals (referrer_id, referred_id, stripe_object_id)
  values (v_referrer.id, p_referred, p_object_id)
  on conflict (referred_id) do nothing;
  if not found then
    return null;
  end if;
  return jsonb_build_object('referrer_id', v_referrer.id, 'referrer_customer', v_referrer.stripe_customer_id,
    'email', (select u.email from auth.users u where u.id = v_referrer.id));
end;
$$;

create function public.mark_referral_rewarded(p_referred uuid, p_cents int) returns void
language sql security definer set search_path = '' as $$
  update public.referrals set reward_cents = p_cents, rewarded_at = now() where referred_id = p_referred and rewarded_at is null;
$$;

-- ===========================================================================
-- Admin : is_admin et double authentification (aal2) obligatoires, chaque action journalisée
-- ===========================================================================
create function public._require_admin() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  v_user uuid := public._require_user();
begin
  if not exists (select 1 from public.profiles where id = v_user and is_admin) then
    raise exception 'Accès réservé.';
  end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Double authentification requise.';
  end if;
  return v_user;
end;
$$;

create function public._log(p_admin uuid, p_action text, p_target text, p_details jsonb) returns void
language sql set search_path = '' as $$
  insert into public.audit_log (admin_id, action, target, details) values (p_admin, p_action, p_target, p_details);
$$;

create function public.admin_overview() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
  v_plans jsonb := (select value from public.settings where key = 'plans');
begin
  return jsonb_build_object(
    'subscribers', (
      select coalesce(jsonb_agg(jsonb_build_object('plan', x.plan, 'interval', x.plan_interval, 'count', x.n)), '[]'::jsonb)
      from (
        select plan, plan_interval, count(*)::int as n from public.profiles
        where plan_status in ('active', 'trialing', 'past_due', 'lifetime')
        group by 1, 2 order by 1, 2
      ) x
    ),
    'mrr_cents', (
      select coalesce(sum(case
        when plan_interval = 'month' then (v_plans -> plan -> 'month' ->> 'amount')::int
        when plan_interval = 'year' then round((v_plans -> plan -> 'year' ->> 'amount')::numeric / 12)::int
        else 0 end), 0)
      from public.profiles where plan_status in ('active', 'trialing', 'past_due') and plan in ('essentiel', 'pro')
    ),
    'revenue_30d_cents', (select coalesce(sum(amount_cents), 0) from public.payments where paid_at > now() - interval '30 days'),
    'revenue_total_cents', (select coalesce(sum(amount_cents), 0) from public.payments),
    'founders', (select count(*) from public.profiles where plan = 'fondateur' and plan_status = 'lifetime'),
    'cancelling', (select count(*) from public.profiles where cancel_at_period_end and plan_status in ('active', 'trialing')),
    'funnel', jsonb_build_object(
      'profiles', (select count(*) from public.profiles),
      'arcs_built', (select count(distinct user_id) from public.enrollments),
      'paying', (select count(*) from public.profiles where plan_status in ('active', 'trialing', 'past_due', 'lifetime'))
    ),
    'arcs', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
      from (select status, count(*)::int as n from public.enrollments group by status) x
    ),
    'stats', (select to_jsonb(s) from public.global_stats() s),
    'sales_by_source', (
      select coalesce(jsonb_agg(jsonb_build_object('source', x.source, 'campaign', x.campaign, 'sales', x.sales,
        'revenue_cents', x.revenue) order by x.revenue desc), '[]'::jsonb)
      from (
        select coalesce(utm_source, '(direct)') as source, coalesce(utm_campaign, '') as campaign,
          count(*)::int as sales, sum(amount_cents)::int as revenue
        from public.payments group by 1, 2
      ) x
    ),
    'waitlist_by_source', (
      select coalesce(jsonb_agg(jsonb_build_object('source', x.source, 'count', x.n) order by x.n desc), '[]'::jsonb)
      from (select coalesce(utm_source, '(direct)') as source, count(*)::int as n from public.waitlist group by 1) x
    ),
    'audits_pending', (select count(*) from public.audits where status in ('open', 'submitted')),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'comps', (
      select coalesce(jsonb_agg(jsonb_build_object('pseudo', pseudo, 'plan', comp_plan, 'until', comp_until)), '[]'::jsonb)
      from public.profiles where comp_until >= public.paris_today()
    )
  );
end;
$$;

create function public.admin_audit_queue() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', au.id, 'status', au.status, 'requested_at', au.requested_at, 'due_at', au.due_at,
      'submitted_at', au.submitted_at, 'penalty', au.penalty, 'pseudo', p.pseudo,
      'has_photo', au.photo_path is not null and au.photo_deleted_at is null,
      'principle', (select pr.if_text || ', ' || pr.then_text from public.validations v
        join public.principles pr on pr.id = v.principle_id where v.id = au.validation_id),
      'challenge', (select ch.title from public.challenge_proofs cp
        join public.challenge_assignments a on a.id = cp.assignment_id
        join public.challenges ch on ch.id = a.challenge_id where cp.id = au.challenge_proof_id),
      'wallet', (select jsonb_build_object('label', w.label, 'amount_cents', w.amount_cents, 'source', w.source)
        from public.wallet_entries w where w.id = au.wallet_entry_id),
      'proof', coalesce(
        (select jsonb_build_object('type', v.proof_type, 'day', v.day, 'link', v.link_url,
          'has_photo', v.photo_path is not null and v.photo_deleted_at is null)
          from public.validations v where v.id = au.validation_id),
        (select jsonb_build_object('type', 'capture', 'day', w.day, 'link', null,
          'has_photo', w.proof_path is not null and w.proof_deleted_at is null)
          from public.wallet_entries w where w.id = au.wallet_entry_id),
        (select jsonb_build_object('type', cp.kind, 'day', cp.day, 'link', cp.link_url,
          'has_photo', cp.photo_path is not null and cp.photo_deleted_at is null)
          from public.challenge_proofs cp where cp.id = au.challenge_proof_id))
    ) order by au.status desc, au.due_at), '[]'::jsonb)
    from public.audits au join public.profiles p on p.id = au.user_id
    where au.status in ('open', 'submitted')
  );
end;
$$;

-- Chemin d'une photo (contrôle ou preuve d'origine) pour générer une URL signée de 60 s. Journalisé.
create function public.admin_proof_path(p_audit_id uuid, p_which text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
  au public.audits;
  v_path text;
begin
  select * into au from public.audits where id = p_audit_id;
  if au.id is null then
    raise exception 'Contrôle introuvable.';
  end if;
  if p_which = 'audit' then
    v_path := au.photo_path;
  else
    v_path := coalesce(
      (select v.photo_path from public.validations v where v.id = au.validation_id),
      (select w.proof_path from public.wallet_entries w where w.id = au.wallet_entry_id),
      (select cp.photo_path from public.challenge_proofs cp where cp.id = au.challenge_proof_id));
  end if;
  if v_path is null then
    raise exception 'Aucune photo.';
  end if;
  perform public._log(v_admin, 'view_proof', au.id::text, jsonb_build_object('which', p_which));
  return v_path;
end;
$$;

create function public.admin_review_audit(p_audit_id uuid, p_pass boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
begin
  if p_pass then
    perform public._pass_audit(p_audit_id, v_admin);
  else
    perform public._fail_audit(p_audit_id, v_admin);
  end if;
  perform public._log(v_admin, case when p_pass then 'audit_pass' else 'audit_fail' end, p_audit_id::text, null);
end;
$$;

create function public.admin_reports() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'reason', r.reason, 'status', r.status, 'created_at', r.created_at,
      'reporter', (select pseudo from public.profiles where id = r.reporter_id),
      'reported', (select pseudo from public.profiles where id = r.reported_user_id),
      'reported_is_public', (select is_public from public.profiles where id = r.reported_user_id)
    ) order by r.created_at desc), '[]'::jsonb)
    from public.reports r where r.status = 'open' or r.created_at > now() - interval '30 days'
  );
end;
$$;

create function public.admin_resolve_report(p_report_id uuid, p_status text, p_hide_profile boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
  r public.reports;
begin
  if p_status not in ('dismissed', 'actioned') then
    raise exception 'Statut invalide.';
  end if;
  update public.reports set status = p_status where id = p_report_id returning * into r;
  if r.id is null then
    raise exception 'Signalement introuvable.';
  end if;
  if coalesce(p_hide_profile, false) then
    update public.profiles set is_public = false where id = r.reported_user_id;
  end if;
  perform public._log(v_admin, 'report_' || p_status, p_report_id::text,
    jsonb_build_object('hide_profile', coalesce(p_hide_profile, false)));
end;
$$;

create function public.admin_squads() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', sq.id, 'name', sq.name, 'description', sq.description,
      'code', sq.code, 'is_public', sq.is_public, 'is_official', sq.is_official, 'start_date', sq.start_date,
      'members', (select count(*) from public.squad_members m where m.squad_id = sq.id),
      'owner', (select pseudo from public.profiles where id = sq.owner_id)
    ) order by sq.is_official desc, sq.created_at desc), '[]'::jsonb)
    from public.squads sq
  );
end;
$$;

-- Escouade officielle (départ collectif possible).
create function public.admin_save_squad(p_id uuid, p_name text, p_description text, p_start_date date, p_is_public boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
  v_id uuid;
  v_code text;
begin
  if length(btrim(coalesce(p_name, ''))) not between 3 and 40 then
    raise exception 'Nom : de 3 à 40 caractères.';
  end if;
  if p_id is null then
    loop
      v_code := public._squad_code();
      exit when not exists (select 1 from public.squads where code = v_code);
    end loop;
    insert into public.squads (name, description, code, is_public, is_official, start_date)
    values (btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), v_code, coalesce(p_is_public, true), true, p_start_date)
    returning id into v_id;
  else
    update public.squads
    set name = btrim(p_name), description = nullif(btrim(coalesce(p_description, '')), ''), start_date = p_start_date,
        is_public = coalesce(p_is_public, is_public)
    where id = p_id and is_official
    returning id into v_id;
    if v_id is null then
      raise exception 'Escouade officielle introuvable.';
    end if;
  end if;
  perform public._log(v_admin, case when p_id is null then 'squad_create' else 'squad_update' end, v_id::text,
    jsonb_build_object('name', p_name, 'start', p_start_date));
  return v_id;
end;
$$;

-- Accès offert (tests, partenaires) jusqu'à une date. p_until null : retiré.
create function public.admin_grant_comp(p_pseudo text, p_plan text, p_until date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
  v_user uuid;
  e public.enrollments;
begin
  if p_until is not null and (p_plan is null or p_plan not in ('essentiel', 'pro')) then
    raise exception 'Plan invalide.';
  end if;
  select id into v_user from public.profiles where pseudo = lower(btrim(coalesce(p_pseudo, '')));
  if v_user is null then
    raise exception 'Pseudo introuvable.';
  end if;
  update public.profiles set comp_plan = case when p_until is null then null else p_plan end, comp_until = p_until
  where id = v_user;
  e := public._open_enrollment(v_user);
  if e.id is not null then
    perform public._activate_enrollment(e.id);
  end if;
  perform public._log(v_admin, 'comp_grant', p_pseudo, jsonb_build_object('plan', p_plan, 'until', p_until));
end;
$$;

create function public.admin_log(p_action text, p_target text, p_details jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public._log(public._require_admin(), left(p_action, 60), left(p_target, 200), p_details);
end;
$$;

create function public.admin_recent_log() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object('action', l.action, 'target', l.target, 'created_at', l.created_at,
      'admin', (select pseudo from public.profiles where id = l.admin_id)) order by l.id desc), '[]'::jsonb)
    from (select * from public.audit_log order by id desc limit 50) l
  );
end;
$$;

-- ===========================================================================
-- Tâches planifiées (service_role uniquement), idempotentes
-- ===========================================================================
create function public.cron_expire_sessions() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  for v_id in
    select id from public.proof_sessions
    where status = 'running' and kind = 'session'
      and coalesce(last_heartbeat_at, started_at) < now() - interval '45 seconds'
  loop
    perform public._break_session(v_id, 'Les battements se sont arrêtés.');
    v_count := v_count + 1;
  end loop;
  update public.proof_sessions set status = 'expired', ended_at = now()
  where status = 'running' and kind in ('reps', 'reveil') and started_at < now() - interval '30 minutes';
  return v_count;
end;
$$;

create function public.cron_close_days() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_day date;
  v_to date;
  v_result text;
  v_closed int := 0;
begin
  perform public.cron_expire_sessions();
  for r in
    select e.id, e.end_date,
      coalesce((select max(d.day) + 1 from public.day_status d where d.enrollment_id = e.id), e.start_date) as from_day
    from public.enrollments e
    where e.status = 'active'
  loop
    v_to := least(public.paris_today() - 1, r.end_date);
    v_day := r.from_day;
    while v_day <= v_to loop
      v_result := public.close_day(r.id, v_day);
      exit when v_result in ('deferred', 'skipped');
      if v_result = 'closed' then
        v_closed := v_closed + 1;
      end if;
      v_day := v_day + 1;
    end loop;
  end loop;
  return v_closed;
end;
$$;

create function public.cron_expire_audits() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  for v_id in select id from public.audits where status = 'open' and due_at < now() loop
    perform public._fail_audit(v_id, null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Rappel du soir : ceux qui ont encore des principes à prouver aujourd'hui, un seul rappel par jour.
create function public.cron_reminder_targets()
returns table (user_id uuid, email text, remaining int, points int, email_reminders boolean, has_push boolean)
language sql stable security definer set search_path = '' as $$
  select e.user_id,
    (select u.email from auth.users u where u.id = e.user_id),
    count(*)::int,
    sum(10 * p.difficulty)::int,
    pr.email_reminders,
    exists (select 1 from public.push_subscriptions s where s.user_id = e.user_id)
  from public.enrollments e
  join public.profiles pr on pr.id = e.user_id
  join public.principles p on p.enrollment_id = e.id
  where e.status = 'active'
    and public.paris_today() between e.start_date and e.end_date
    and public._plan(e.user_id) is not null
    and public._on_day(p.active_from, p.active_until, p.days, public.paris_today())
    and not exists (select 1 from public.validations v where v.principle_id = p.id and v.day = public.paris_today())
    and not exists (select 1 from public.joker_days j where j.enrollment_id = e.id and j.day = public.paris_today())
    and not exists (select 1 from public.reminder_log r where r.user_id = e.user_id and r.day = public.paris_today())
  group by e.user_id, pr.email_reminders;
$$;

create function public.mark_reminded(p_user uuid, p_channel text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.reminder_log (user_id, day, channel) values (p_user, public.paris_today(), p_channel)
  on conflict do nothing;
  return found;
end;
$$;

create function public.push_targets(p_user uuid)
returns table (endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth from public.push_subscriptions s where s.user_id = p_user;
$$;

create function public.delete_push_endpoint(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

-- Récapitulatif du lundi : les 7 derniers jours.
create function public.weekly_recap_targets()
returns table (user_id uuid, email text, email_reminders boolean, points int, green int, days int, streak int,
  level int, ovr int)
language sql stable security definer set search_path = '' as $$
  select e.user_id,
    (select u.email from auth.users u where u.id = e.user_id),
    pr.email_reminders,
    coalesce((select sum(l.delta) from public.points_ledger l where l.user_id = e.user_id
      and l.day between public.paris_today() - 7 and public.paris_today() - 1), 0)::int,
    (select count(*) from public.day_status d where d.enrollment_id = e.id and d.status = 'green'
      and d.day between public.paris_today() - 7 and public.paris_today() - 1)::int,
    (select count(*) from public.day_status d where d.enrollment_id = e.id
      and d.day between public.paris_today() - 7 and public.paris_today() - 1)::int,
    coalesce(ps.streak, 0), coalesce(ps.level, 1), coalesce(ps.ovr, 0)
  from public.enrollments e
  join public.profiles pr on pr.id = e.user_id
  left join public.player_stats ps on ps.user_id = e.user_id
  where e.status = 'active' and public.paris_today() - 7 between e.start_date and e.end_date;
$$;

-- Photos de plus de 30 jours (et dépôts orphelins) à supprimer. Les photos avant / après restent.
create function public.cron_photo_cleanup_targets() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(o.name), '{}')
  from storage.objects o
  where o.bucket_id = 'proofs'
    and not exists (select 1 from public.enrollments e where e.before_photo_path = o.name or e.after_photo_path = o.name)
    and (o.created_at < now() - interval '30 days'
      or (o.created_at < now() - interval '1 day'
        and not exists (select 1 from public.validations v where v.photo_path = o.name)
        and not exists (select 1 from public.audits a where a.photo_path = o.name)
        and not exists (select 1 from public.challenge_proofs cp where cp.photo_path = o.name)
        and not exists (select 1 from public.wallet_entries w where w.proof_path = o.name)));
$$;

create function public.mark_photos_deleted(p_paths text[]) returns void
language sql security definer set search_path = '' as $$
  update public.validations set photo_deleted_at = now() where photo_path = any(p_paths) and photo_deleted_at is null;
  update public.audits set photo_deleted_at = now() where photo_path = any(p_paths) and photo_deleted_at is null;
  update public.challenge_proofs set photo_deleted_at = now() where photo_path = any(p_paths) and photo_deleted_at is null;
  update public.wallet_entries set proof_deleted_at = now() where proof_path = any(p_paths) and proof_deleted_at is null;
$$;

-- Arcs tenus sans remise de fidélité appliquée.
create function public.cron_loyalty_targets()
returns table (enrollment_id uuid, user_id uuid, email text, subscription_id text, plan text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.user_id, (select u.email from auth.users u where u.id = e.user_id), pr.stripe_subscription_id, pr.plan
  from public.enrollments e join public.profiles pr on pr.id = e.user_id
  where e.status = 'completed' and e.loyalty_applied_at is null;
$$;

create function public.mark_loyalty_applied(p_enrollment uuid) returns void
language sql security definer set search_path = '' as $$
  update public.enrollments set loyalty_applied_at = now() where id = p_enrollment and loyalty_applied_at is null;
$$;

-- Arcs terminés ces 7 derniers jours (email de bilan, envoyé une seule fois grâce à email_log).
create function public.cron_arc_results()
returns table (enrollment_id uuid, user_id uuid, email text, status text, green int, arc_number int)
language sql stable security definer set search_path = '' as $$
  select e.id, e.user_id, (select u.email from auth.users u where u.id = e.user_id), e.status,
    (select count(*) from public.day_status d where d.enrollment_id = e.id and d.status = 'green')::int, e.arc_number
  from public.enrollments e
  where e.status in ('completed', 'failed') and e.closed_at > now() - interval '7 days';
$$;

create function public.log_email_once(p_user uuid, p_kind text, p_ref text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.email_log (user_id, kind, ref) values (p_user, p_kind, p_ref) on conflict do nothing;
  return found;
end;
$$;

create function public.set_audit_rate(p_rate numeric) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_rate < 0 or p_rate > 1 then
    raise exception 'Taux invalide.';
  end if;
  insert into public.settings (key, value) values ('audit_rate', to_jsonb(p_rate))
  on conflict (key) do update set value = excluded.value;
end;
$$;

create function public.cleanup_rate_limits() returns void
language sql security definer set search_path = '' as $$
  delete from public.rate_limits where reset_at < now() - interval '1 day';
$$;

-- ===========================================================================
-- Droits d'exécution : rien par défaut, puis le strict nécessaire
-- ===========================================================================
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.paris_today() to anon, authenticated, service_role;
grant execute on function public.paris_now() to anon, authenticated, service_role;

-- Public (sans compte)
grant execute on function public.leaderboard(text, text, uuid) to anon, authenticated, service_role;
grant execute on function public.global_stats() to anon, authenticated, service_role;
grant execute on function public.achievement_rarity() to anon, authenticated, service_role;
grant execute on function public.public_profile(text) to anon, authenticated, service_role;
grant execute on function public.plans_public() to anon, authenticated, service_role;
grant execute on function public.public_squads() to anon, authenticated, service_role;
grant execute on function public.collective_starts() to anon, authenticated, service_role;
grant execute on function public.squad_detail(uuid) to anon, authenticated, service_role;

-- Utilisateur connecté
grant execute on function public.save_profile(text, int, boolean, boolean, text, text) to authenticated;
grant execute on function public.save_arc(text, text, text, numeric, text, boolean, text[], text, text, int, date, uuid) to authenticated;
grant execute on function public.regenerate_principles() to authenticated;
grant execute on function public.set_start_date(date) to authenticated;
grant execute on function public.activate_my_arc() to authenticated;
grant execute on function public.save_principle(uuid, text, text, text, text, jsonb, int[], int) to authenticated;
grant execute on function public.add_template_principle(text) to authenticated;
grant execute on function public.remove_principle(uuid) to authenticated;
grant execute on function public.validate_declaratif(uuid) to authenticated;
grant execute on function public.validate_link(uuid, text) to authenticated;
grant execute on function public.start_proof_session(uuid) to authenticated;
grant execute on function public.heartbeat(uuid, text, boolean, int) to authenticated;
grant execute on function public.abandon_session(uuid, text) to authenticated;
grant execute on function public.complete_session(uuid, text) to authenticated;
grant execute on function public.complete_reps(uuid, text, jsonb) to authenticated;
grant execute on function public.complete_wake_check(uuid, text, text) to authenticated;
grant execute on function public.use_joker() to authenticated;
grant execute on function public.delete_wallet_entry(uuid) to authenticated;
grant execute on function public.validate_challenge_declaratif(uuid) to authenticated;
grant execute on function public.validate_challenge_link(uuid, text) to authenticated;
grant execute on function public.start_challenge_session(uuid, int) to authenticated;
grant execute on function public.my_dashboard() to authenticated;
grant execute on function public.my_plan() to authenticated;
grant execute on function public.day_detail(date) to authenticated;
grant execute on function public.my_principles() to authenticated;
grant execute on function public.my_profile() to authenticated;
grant execute on function public.my_wallet() to authenticated;
grant execute on function public.my_arc_photos() to authenticated;
grant execute on function public.update_profile_settings(boolean, text, boolean, boolean, text) to authenticated;
grant execute on function public.new_achievements() to authenticated;
grant execute on function public.mark_achievements_seen() to authenticated;
grant execute on function public.mark_level_seen() to authenticated;
grant execute on function public.create_squad(text, text, boolean) to authenticated;
grant execute on function public.join_squad(text) to authenticated;
grant execute on function public.join_public_squad(uuid) to authenticated;
grant execute on function public.leave_squad(uuid) to authenticated;
grant execute on function public.my_squads() to authenticated;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.delete_push_subscriptions() to authenticated;
grant execute on function public.report_user(text, text) to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- Admin (vérifie is_admin + aal2 à l'intérieur)
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_audit_queue() to authenticated;
grant execute on function public.admin_proof_path(uuid, text) to authenticated;
grant execute on function public.admin_review_audit(uuid, boolean) to authenticated;
grant execute on function public.admin_reports() to authenticated;
grant execute on function public.admin_resolve_report(uuid, text, boolean) to authenticated;
grant execute on function public.admin_squads() to authenticated;
grant execute on function public.admin_save_squad(uuid, text, text, date, boolean) to authenticated;
grant execute on function public.admin_grant_comp(text, text, date) to authenticated;
grant execute on function public.admin_log(text, text, jsonb) to authenticated;
grant execute on function public.admin_recent_log() to authenticated;

-- Serveur uniquement (clé service_role)
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
grant execute on function public.validate_photo(uuid, uuid, text) to service_role;
grant execute on function public.validate_challenge_photo(uuid, uuid, text) to service_role;
grant execute on function public.submit_audit_photo(uuid, uuid, text) to service_role;
grant execute on function public.add_wallet_entry(uuid, int, text, text, date, text) to service_role;
grant execute on function public.set_avatar(uuid, text) to service_role;
grant execute on function public.set_arc_photo(uuid, text, text) to service_role;
grant execute on function public.plan_price(text, text) to service_role;
grant execute on function public.billing_profile(uuid) to service_role;
grant execute on function public.set_stripe_customer(uuid, text) to service_role;
grant execute on function public.set_referral_promo(uuid, text) to service_role;
grant execute on function public.sync_subscription(uuid, text, text, text, text, text, timestamptz, boolean) to service_role;
grant execute on function public.grant_lifetime(uuid, text) to service_role;
grant execute on function public.record_payment(text, uuid, text, text, text, int, text) to service_role;
grant execute on function public.record_referral(text, uuid, text) to service_role;
grant execute on function public.mark_referral_rewarded(uuid, int) to service_role;
grant execute on function public.cron_expire_sessions() to service_role;
grant execute on function public.cron_close_days() to service_role;
grant execute on function public.cron_expire_audits() to service_role;
grant execute on function public.cron_reminder_targets() to service_role;
grant execute on function public.mark_reminded(uuid, text) to service_role;
grant execute on function public.push_targets(uuid) to service_role;
grant execute on function public.delete_push_endpoint(text) to service_role;
grant execute on function public.weekly_recap_targets() to service_role;
grant execute on function public.cron_photo_cleanup_targets() to service_role;
grant execute on function public.mark_photos_deleted(text[]) to service_role;
grant execute on function public.cron_loyalty_targets() to service_role;
grant execute on function public.mark_loyalty_applied(uuid) to service_role;
grant execute on function public.cron_arc_results() to service_role;
grant execute on function public.log_email_once(uuid, text, text) to service_role;
grant execute on function public.set_audit_rate(numeric) to service_role;
grant execute on function public.cleanup_rate_limits() to service_role;
