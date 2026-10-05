-- Lectures (tableau de bord, classement, profils), réglages, RGPD, admin et tâches planifiées.

-- ===========================================================================
-- Scores et calendrier
-- ===========================================================================
create function public._enrollment_scores(p_cohort uuid, p_since date)
returns table (enrollment_id uuid, user_id uuid, points int, green int, white int)
language sql stable set search_path = '' as $$
  select e.id, e.user_id,
    coalesce((select sum(l.delta) from public.points_ledger l
      where l.enrollment_id = e.id and (p_since is null or l.day >= p_since)), 0)::int,
    (select count(*) from public.day_status d where d.enrollment_id = e.id and d.status = 'green')::int,
    (select count(*) from public.day_status d where d.enrollment_id = e.id and d.status = 'white')::int
  from public.enrollments e
  where e.cohort_id = p_cohort and e.status <> 'pending_payment';
$$;

create function public._calendar(p_enrollment uuid) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'day', d::date,
    'status', case
      when e.started_on is null or d::date < e.started_on then 'none'
      when ds.status is not null then ds.status
      when d::date = public.paris_today() then 'today'
      when d::date > public.paris_today() then 'future'
      else 'pending'
    end) order by d), '[]'::jsonb)
  from public.enrollments e
  join public.cohorts c on c.id = e.cohort_id
  cross join lateral generate_series(c.start_date::timestamp, c.end_date::timestamp, interval '1 day') d
  left join public.day_status ds on ds.enrollment_id = e.id and ds.day = d::date
  where e.id = p_enrollment;
$$;

create function public._unlocked_arts(p_user uuid) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(au.slug order by au.slug), '{}')
  from public.art_unlocks au
  where au.unlock = 'base'
    or (au.unlock like 'level:%' and exists (
      select 1 from public.enrollments e where e.user_id = p_user and e.level >= split_part(au.unlock, ':', 2)::int))
    or (au.unlock like 'achievement:%' and exists (
      select 1 from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
      where ua.user_id = p_user and a.code = split_part(au.unlock, ':', 2)));
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
  c public.cohorts;
  v_state text;
  v_points int;
  v_week_points int;
  v_rank int;
  v_total int;
  v_principles jsonb;
  v_challenge jsonb;
  v_audits jsonb;
  v_running jsonb;
  a public.challenge_assignments;
  ch public.challenges;
begin
  select * into prof from public.profiles where id = v_user;
  if prof.id is null then
    return jsonb_build_object('profile', null);
  end if;
  e := public._enrollment_for_user(v_user);
  if e.id is null then
    return jsonb_build_object('profile', jsonb_build_object('pseudo', prof.pseudo, 'is_admin', prof.is_admin),
      'enrollment', null);
  end if;
  select * into c from public.cohorts where id = e.cohort_id;

  v_state := case
    when e.status = 'pending_payment' then 'pending'
    when e.status <> 'active' then e.status
    when v_today < greatest(c.start_date, coalesce(e.started_on, c.start_date)) then 'before'
    when v_today > c.end_date then 'ended'
    else 'running'
  end;

  if v_state = 'running' then
    insert into public.app_opens (enrollment_id, day) values (e.id, v_today) on conflict do nothing;
    perform public._ensure_assignment(e.id);
  end if;

  select coalesce(sum(delta), 0) into v_points from public.points_ledger where enrollment_id = e.id;
  select coalesce(sum(delta), 0) into v_week_points from public.points_ledger
  where enrollment_id = e.id and day >= public._week_monday(v_today);

  if e.status <> 'pending_payment' then
    select x.rk, x.tot into v_rank, v_total from (
      select sc.enrollment_id, (rank() over (order by sc.points desc, sc.green desc, sc.white asc))::int as rk,
        (count(*) over ())::int as tot
      from public._enrollment_scores(c.id, null) sc
    ) x where x.enrollment_id = e.id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'position', p.position, 'if_text', p.if_text, 'then_text', p.then_text,
    'proof_type', p.proof_type, 'difficulty', p.difficulty, 'max_difficulty', p.max_difficulty,
    'value', 10 * p.difficulty, 'days', p.days, 'target', p.target, 'source', p.source,
    'scheduled_today', public._is_scheduled(p.days, v_today),
    'validation', (select jsonb_build_object('status', v.status, 'strength', v.strength, 'points', v.points,
        'proof_type', v.proof_type)
      from public.validations v where v.principle_id = p.id and v.day = v_today)
  ) order by p.position), '[]'::jsonb) into v_principles
  from public.principles p where p.enrollment_id = e.id;

  select * into a from public.challenge_assignments
  where enrollment_id = e.id and week = public._arc_week(c.start_date, v_today);
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
      (select ch2.title from public.challenge_proofs cp
        join public.challenge_assignments a2 on a2.id = cp.assignment_id
        join public.challenges ch2 on ch2.id = a2.challenge_id
        where cp.id = au.challenge_proof_id))
  ) order by au.due_at), '[]'::jsonb) into v_audits
  from public.audits au where au.enrollment_id = e.id and au.status = 'open';

  select jsonb_build_object('id', s.id, 'kind', s.kind, 'principle_id', s.principle_id,
    'assignment_id', s.challenge_assignment_id)
  into v_running
  from public.proof_sessions s where s.user_id = v_user and s.status = 'running' limit 1;

  return jsonb_build_object(
    'profile', jsonb_build_object('pseudo', prof.pseudo, 'is_admin', prof.is_admin, 'is_public', prof.is_public,
      'referral_code', prof.referral_code,
      'referral_sales', (select count(*) from public.referrals r where r.referrer_id = v_user)),
    'enrollment', jsonb_build_object('id', e.id, 'status', e.status, 'level', e.level, 'level_seen', e.level_seen,
      'category', e.category, 'goal_title', e.goal_title, 'started_on', e.started_on,
      'stake_status', e.stake_status, 'stake_cents', e.stake_cents, 'loyalty_code', e.loyalty_code),
    'cohort', jsonb_build_object('id', c.id, 'name', c.name, 'start_date', c.start_date, 'end_date', c.end_date,
      'price_cents', c.price_cents, 'early_price_cents', c.early_price_cents),
    'state', v_state,
    'today', v_today,
    'day_number', case when v_today between c.start_date and c.end_date then v_today - c.start_date + 1 end,
    'points', v_points,
    'week_points', v_week_points,
    'rank', v_rank,
    'total', v_total,
    'principles', v_principles,
    'calendar', public._calendar(e.id),
    'challenge', v_challenge,
    'audits', v_audits,
    'running_session', v_running,
    'unseen_achievements', (select count(*) from public.user_achievements ua
      where ua.user_id = v_user and ua.seen_at is null),
    'level_up', e.level > e.level_seen
  );
end;
$$;

-- Détail d'un jour du calendrier.
create function public.day_detail(p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._enrollment_for_user(v_user);
begin
  if e.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'day', p_day,
    'status', (select status from public.day_status where enrollment_id = e.id and day = p_day),
    'points', (select coalesce(sum(delta), 0) from public.points_ledger where enrollment_id = e.id and day = p_day),
    'principles', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'then_text', p.then_text, 'proof_type', p.proof_type,
        'validation', (select jsonb_build_object('status', v.status, 'strength', v.strength, 'points', v.points)
          from public.validations v where v.principle_id = p.id and v.day = p_day),
        'miss', (select jsonb_build_object('points', m.points, 'streak', m.streak, 'white', m.white)
          from public.misses m where m.principle_id = p.id and m.day = p_day)
      ) order by p.position), '[]'::jsonb)
      from public.principles p
      where p.enrollment_id = e.id and public._is_scheduled(p.days, p_day)
    )
  );
end;
$$;

-- ===========================================================================
-- Données publiques : uniquement des champs sûrs
-- ===========================================================================
create function public.leaderboard(p_cohort_id uuid, p_category text default null, p_period text default 'arc')
returns table (rank int, pseudo text, category text, points int, green_days int, level int, goal_title text,
  is_me boolean, is_public boolean)
language sql stable security definer set search_path = '' as $$
  with s as (
    select sc.*, e.category, e.level, e.goal_public, e.goal_title, p.is_public, p.pseudo
    from public._enrollment_scores(
      p_cohort_id,
      case when p_period = 'semaine' then public._week_monday(public.paris_today()) end
    ) sc
    join public.enrollments e on e.id = sc.enrollment_id
    join public.profiles p on p.id = e.user_id
    where p_category is null or e.category = p_category
  )
  select (rank() over (order by s.points desc, s.green desc, s.white asc))::int,
    case when s.is_public then s.pseudo else 'Anonyme' end,
    s.category, s.points, s.green, s.level,
    case when s.goal_public then s.goal_title end,
    coalesce(s.user_id = auth.uid(), false),
    s.is_public
  from s
  order by 1, s.green desc;
$$;

create function public.cohort_stats(p_cohort_id uuid)
returns table (inscrits int, actifs int, ont_lache int, ont_termine int, verts_aujourdhui int)
language sql stable security definer set search_path = '' as $$
  select
    ((select count(*) from public.enrollments e where e.cohort_id = p_cohort_id and e.status <> 'pending_payment')
      + (select count(distinct pr.email) from public.presales pr
          where pr.cohort_id = p_cohort_id and pr.claimed_by is null and pr.refunded_at is null))::int,
    (select count(*) from public.enrollments e where e.cohort_id = p_cohort_id and e.status = 'active')::int,
    (select count(*) from public.enrollments e where e.cohort_id = p_cohort_id and e.status = 'abandoned')::int,
    (select count(*) from public.enrollments e where e.cohort_id = p_cohort_id and e.status = 'completed')::int,
    (select count(*) from public.enrollments e
      join public.cohorts c on c.id = e.cohort_id
      where e.cohort_id = p_cohort_id and e.status = 'active'
        and public.paris_today() between greatest(c.start_date, e.started_on) and c.end_date
        and exists (select 1 from public.principles pr where pr.enrollment_id = e.id
          and public._is_scheduled(pr.days, public.paris_today()))
        and not exists (
          select 1 from public.principles pr
          where pr.enrollment_id = e.id and public._is_scheduled(pr.days, public.paris_today())
            and not exists (select 1 from public.validations v
              where v.principle_id = pr.id and v.day = public.paris_today() and v.status <> 'rejected')
        ))::int;
$$;

-- La landing affiche le même chiffre que le classement.
create or replace function public.cohort_signups(p_cohort_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select s.inscrits from public.cohort_stats(p_cohort_id) s;
$$;

create function public.achievement_rarity(p_cohort_id uuid)
returns table (code text, title text, description text, points int, art_slug text, holders int, total int, percent int)
language sql stable security definer set search_path = '' as $$
  with t as (
    select count(*)::int as total from public.enrollments
    where cohort_id = p_cohort_id and status <> 'pending_payment'
  )
  select a.code, a.title, a.description, a.points, a.art_slug,
    (select count(*) from public.user_achievements ua join public.enrollments e on e.id = ua.enrollment_id
      where ua.achievement_id = a.id and e.cohort_id = p_cohort_id)::int,
    t.total,
    case when t.total = 0 then 0 else round(100.0 * (
      select count(*) from public.user_achievements ua join public.enrollments e on e.id = ua.enrollment_id
      where ua.achievement_id = a.id and e.cohort_id = p_cohort_id) / t.total)::int end
  from public.achievements a cross join t
  order by a.sort;
$$;

create function public.public_profile(p_pseudo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  prof public.profiles;
  e public.enrollments;
  c public.cohorts;
  v_rank int;
  v_total int;
  v_points int;
begin
  select * into prof from public.profiles where pseudo = lower(btrim(coalesce(p_pseudo, ''))) and is_public;
  if prof.id is null then
    return null;
  end if;
  select en.* into e from public.enrollments en join public.cohorts co on co.id = en.cohort_id
  where en.user_id = prof.id and en.status <> 'pending_payment'
  order by co.start_date desc limit 1;
  if e.id is not null then
    select * into c from public.cohorts where id = e.cohort_id;
    select x.rk, x.tot, x.points into v_rank, v_total, v_points from (
      select sc.enrollment_id, sc.points, (rank() over (order by sc.points desc, sc.green desc, sc.white asc))::int as rk,
        (count(*) over ())::int as tot
      from public._enrollment_scores(c.id, null) sc
    ) x where x.enrollment_id = e.id;
  end if;
  return jsonb_build_object(
    'pseudo', prof.pseudo,
    'art', coalesce(prof.profile_art_slug, 'friedrich-moine'),
    'refused_proofs', prof.refused_proofs,
    'level', e.level,
    'status', e.status,
    'category', e.category,
    'goal', case when e.goal_public then e.goal_title end,
    'cohort', c.name,
    'day_number', case when public.paris_today() between c.start_date and c.end_date
      then public.paris_today() - c.start_date + 1 end,
    'points', v_points,
    'rank', v_rank,
    'total', v_total,
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

-- ===========================================================================
-- Profil, réglages, RGPD
-- ===========================================================================
create function public.my_profile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  prof public.profiles;
  e public.enrollments := public._enrollment_for_user(v_user);
begin
  select * into prof from public.profiles where id = v_user;
  if prof.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'pseudo', prof.pseudo,
    'email', (select u.email from auth.users u where u.id = v_user),
    'is_public', prof.is_public,
    'is_admin', prof.is_admin,
    'email_reminders', prof.email_reminders,
    'profile_art_slug', coalesce(prof.profile_art_slug, 'friedrich-moine'),
    'refused_proofs', prof.refused_proofs,
    'referral_code', prof.referral_code,
    'referral_ready', prof.stripe_promotion_code_id is not null,
    'referral_sales', (select count(*) from public.referrals r where r.referrer_id = v_user),
    'arts', to_jsonb(public._unlocked_arts(v_user)),
    'push_subscriptions', (select count(*) from public.push_subscriptions s where s.user_id = v_user),
    'level', e.level,
    'cohort_id', e.cohort_id,
    'enrollment_status', e.status,
    'loyalty_code', e.loyalty_code,
    'achievements', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', a.code, 'title', a.title, 'description', a.description, 'points', a.points, 'art_slug', a.art_slug,
        'unlocked_at', ua.unlocked_at,
        'percent', (select r.percent from public.achievement_rarity(e.cohort_id) r where r.code = a.code)
      ) order by a.sort), '[]'::jsonb)
      from public.achievements a
      left join public.user_achievements ua on ua.achievement_id = a.id and ua.user_id = v_user and ua.enrollment_id = e.id
    )
  );
end;
$$;

create function public.update_profile_settings(p_is_public boolean, p_art_slug text, p_email_reminders boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
begin
  if p_art_slug is not null and not (p_art_slug = any(public._unlocked_arts(v_user))) then
    raise exception 'Cette œuvre n''est pas encore débloquée.';
  end if;
  update public.profiles
  set is_public = coalesce(p_is_public, is_public),
      profile_art_slug = coalesce(p_art_slug, profile_art_slug),
      email_reminders = coalesce(p_email_reminders, email_reminders)
  where id = v_user;
  if not found then
    raise exception 'Profil introuvable.';
  end if;
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
  update public.enrollments set level_seen = level where user_id = auth.uid() and level_seen <> level;
$$;

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
    'profile', (select to_jsonb(p) - 'stripe_promotion_code_id' from public.profiles p where p.id = v_user),
    'enrollments', (select coalesce(jsonb_agg(to_jsonb(e) - 'stripe_checkout_session_id' - 'stake_payment_intent_id'), '[]')
      from public.enrollments e where e.user_id = v_user),
    'principles', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.principles p
      join public.enrollments e on e.id = p.enrollment_id where e.user_id = v_user),
    'validations', (select coalesce(jsonb_agg(to_jsonb(v)), '[]') from public.validations v
      join public.enrollments e on e.id = v.enrollment_id where e.user_id = v_user),
    'proof_sessions', (select coalesce(jsonb_agg(to_jsonb(s) - 'nonce' - 'data'), '[]')
      from public.proof_sessions s where s.user_id = v_user),
    'points_ledger', (select coalesce(jsonb_agg(to_jsonb(l)), '[]') from public.points_ledger l where l.user_id = v_user),
    'day_status', (select coalesce(jsonb_agg(to_jsonb(d)), '[]') from public.day_status d
      join public.enrollments e on e.id = d.enrollment_id where e.user_id = v_user),
    'audits', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.audits a where a.user_id = v_user),
    'achievements', (select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'unlocked_at', ua.unlocked_at)), '[]')
      from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where ua.user_id = v_user),
    'challenge_assignments', (select coalesce(jsonb_agg(to_jsonb(ca)), '[]') from public.challenge_assignments ca
      join public.enrollments e on e.id = ca.enrollment_id where e.user_id = v_user),
    'reports_filed', (select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'created_at', r.created_at)), '[]')
      from public.reports r where r.reporter_id = v_user)
  );
end;
$$;

-- Suppression de compte (RGPD). Les préventes restent (obligation comptable), détachées du compte.
-- Renvoie les chemins de photos à supprimer du stockage.
create function public.delete_my_account() returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_email text := lower((select u.email from auth.users u where u.id = v_user));
  v_paths text[];
begin
  select coalesce(array_agg(o.name), '{}') into v_paths
  from storage.objects o where o.bucket_id = 'proofs' and o.name like v_user::text || '/%';
  perform set_config('nonante.account_deletion', 'on', true);
  delete from public.points_ledger where user_id = v_user;
  delete from public.profiles where id = v_user;
  delete from public.waitlist where email = v_email;
  return v_paths;
end;
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
begin
  return jsonb_build_object(
    'cohorts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'start_date', c.start_date, 'end_date', c.end_date, 'enroll_open', c.enroll_open,
        'is_test', c.is_test, 'price_cents', c.price_cents, 'early_price_cents', c.early_price_cents,
        'closed_at', c.closed_at,
        'stats', (select to_jsonb(s) from public.cohort_stats(c.id) s),
        'pending', (select count(*) from public.enrollments e where e.cohort_id = c.id and e.status = 'pending_payment'),
        'failed', (select count(*) from public.enrollments e where e.cohort_id = c.id and e.status = 'failed'),
        'revenue_cents', (
          coalesce((select sum(e.amount_paid_cents) from public.enrollments e
            where e.cohort_id = c.id and e.presale_id is null and e.status <> 'pending_payment'), 0)
          + coalesce((select sum(p.amount_paid_cents) from public.presales p
            where p.cohort_id = c.id and p.refunded_at is null), 0)),
        'waitlist', (select count(*) from public.waitlist w where w.cohort_id = c.id)
      ) order by c.start_date desc), '[]'::jsonb)
      from public.cohorts c
    ),
    'sales_by_source', (
      select coalesce(jsonb_agg(jsonb_build_object('source', x.source, 'campaign', x.campaign, 'sales', x.sales,
        'revenue_cents', x.revenue) order by x.sales desc), '[]'::jsonb)
      from (
        select coalesce(src, '(direct)') as source, coalesce(cmp, '') as campaign, count(*)::int as sales,
          sum(amount)::int as revenue
        from (
          select p.utm_source as src, p.utm_campaign as cmp, p.amount_paid_cents as amount
          from public.presales p where p.refunded_at is null
          union all
          select e.utm_source, e.utm_campaign, e.amount_paid_cents from public.enrollments e
          where e.presale_id is null and e.status <> 'pending_payment'
        ) sales
        group by 1, 2
      ) x
    ),
    'waitlist_by_source', (
      select coalesce(jsonb_agg(jsonb_build_object('source', x.source, 'count', x.n) order by x.n desc), '[]'::jsonb)
      from (select coalesce(utm_source, '(direct)') as source, count(*)::int as n from public.waitlist group by 1) x
    ),
    'audits_pending', (select count(*) from public.audits where status in ('open', 'submitted')),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'stakes_to_settle', (select count(*) from public.enrollments
      where (stake_status = 'forfeited' and stake_donated_at is null) or (stake_status = 'held' and status = 'completed'))
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
      'proof', coalesce(
        (select jsonb_build_object('type', v.proof_type, 'day', v.day, 'link', v.link_url,
          'has_photo', v.photo_path is not null and v.photo_deleted_at is null)
          from public.validations v where v.id = au.validation_id),
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

create function public.admin_save_cohort(
  p_id uuid,
  p_name text,
  p_start_date date,
  p_enroll_open boolean,
  p_price_cents int,
  p_early_price_cents int,
  p_is_test boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
  v_id uuid;
  c public.cohorts;
begin
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Nom invalide.';
  end if;
  if p_price_cents is null or p_price_cents < 100 or p_early_price_cents is null or p_early_price_cents < 100 then
    raise exception 'Prix invalide (1 € minimum).';
  end if;
  if p_id is null then
    insert into public.cohorts (name, start_date, enroll_open, price_cents, early_price_cents, is_test)
    values (btrim(p_name), p_start_date, coalesce(p_enroll_open, true), p_price_cents, p_early_price_cents,
      coalesce(p_is_test, false))
    returning id into v_id;
    perform public._log(v_admin, 'cohort_create', v_id::text, jsonb_build_object('name', p_name, 'start', p_start_date));
  else
    select * into c from public.cohorts where id = p_id;
    if c.id is null then
      raise exception 'Cohorte introuvable.';
    end if;
    if p_start_date <> c.start_date and exists (
      select 1 from public.enrollments where cohort_id = p_id and status <> 'pending_payment'
    ) then
      raise exception 'La date de départ ne change plus une fois des inscrits payés.';
    end if;
    update public.cohorts
    set name = btrim(p_name), start_date = p_start_date, enroll_open = coalesce(p_enroll_open, enroll_open),
        price_cents = p_price_cents, early_price_cents = p_early_price_cents, is_test = coalesce(p_is_test, is_test),
        -- Un prix modifié invalide les prix Stripe : ils seront recalculés.
        stripe_price_id = case when price_cents = p_price_cents then stripe_price_id end,
        stripe_early_price_id = case when early_price_cents = p_early_price_cents then stripe_early_price_id end
    where id = p_id;
    v_id := p_id;
    perform public._log(v_admin, 'cohort_update', v_id::text, jsonb_build_object(
      'name', p_name, 'start', p_start_date, 'open', p_enroll_open, 'price', p_price_cents, 'early', p_early_price_cents));
  end if;
  return v_id;
end;
$$;

create function public.admin_stakes() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'enrollment_id', e.id, 'pseudo', p.pseudo, 'cohort', c.name, 'status', e.status,
      'stake_status', e.stake_status, 'stake_cents', e.stake_cents, 'donated_at', e.stake_donated_at
    ) order by c.start_date desc), '[]'::jsonb)
    from public.enrollments e
    join public.profiles p on p.id = e.user_id
    join public.cohorts c on c.id = e.cohort_id
    where e.stake_status <> 'none'
  );
end;
$$;

create function public.admin_mark_stake_donated(p_enrollment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public._require_admin();
begin
  update public.enrollments set stake_donated_at = now()
  where id = p_enrollment and stake_status = 'forfeited' and stake_donated_at is null;
  if not found then
    raise exception 'Aucune mise à reverser pour cette inscription.';
  end if;
  perform public._log(v_admin, 'stake_donated', p_enrollment::text, null);
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
    select e.id, e.started_on, c.end_date,
      coalesce((select max(d.day) + 1 from public.day_status d where d.enrollment_id = e.id),
        greatest(c.start_date, e.started_on)) as from_day
    from public.enrollments e join public.cohorts c on c.id = e.cohort_id
    where e.status = 'active' and e.started_on is not null
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

-- Lundi : juge les épreuves des semaines passées, monte les niveaux, attribue l'épreuve de la semaine.
create function public.cron_weekly() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.enrollments;
  c public.cohorts;
  v_assignment uuid;
  v_week int;
  v_evaluated int := 0;
  v_levels int := 0;
  v_last3 text[];
  v_weeks int[];
begin
  for e in select * from public.enrollments where status = 'active' and started_on is not null loop
    select * into c from public.cohorts where id = e.cohort_id;
    v_week := public._arc_week(c.start_date, least(public.paris_today(), c.end_date + 1));

    for v_assignment in
      select id from public.challenge_assignments
      where enrollment_id = e.id and status = 'assigned' and week < v_week
    loop
      perform public._evaluate_assignment(v_assignment, true);
      v_evaluated := v_evaluated + 1;
    end loop;

    -- +1 niveau : 3 épreuves réussies d'affilée et aucun jour blanc sur 14 jours.
    if e.level < 3 then
      select array_agg(status order by week desc), array_agg(week order by week desc)
      into v_last3, v_weeks
      from (
        select status, week from public.challenge_assignments
        where enrollment_id = e.id and week < v_week and week > e.last_level_up_week
        order by week desc limit 3
      ) t;
      if cardinality(v_last3) = 3 and v_last3 = array['done', 'done', 'done']
        and v_weeks[1] - v_weeks[3] = 2
        and not exists (
          select 1 from public.day_status
          where enrollment_id = e.id and status = 'white' and day >= public.paris_today() - 14
        ) then
        update public.enrollments set level = level + 1, last_level_up_week = v_weeks[1] where id = e.id;
        update public.principles set difficulty = max_difficulty where enrollment_id = e.id;
        v_levels := v_levels + 1;
      end if;
    end if;

    perform public._ensure_assignment(e.id);
  end loop;
  return jsonb_build_object('evaluated', v_evaluated, 'level_ups', v_levels);
end;
$$;

-- Fin d'arc : tenu (≥ 75 jours verts, jamais plus de 3 non verts d'affilée) ou raté.
-- Renvoie les arcs tenus (codes fidélité, emails) et les mises à rembourser.
create function public.cron_cohort_end() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.cohorts;
  e public.enrollments;
  v_green int;
  v_worst int;
  v_completed jsonb := '[]';
  v_failed jsonb := '[]';
  v_all_closed boolean;
begin
  perform public.cron_close_days();
  for c in select * from public.cohorts where end_date < public.paris_today() and closed_at is null loop
    v_all_closed := not exists (
      select 1 from public.enrollments en
      where en.cohort_id = c.id and en.status = 'active' and en.started_on is not null
        and not exists (select 1 from public.day_status d where d.enrollment_id = en.id and d.day = c.end_date)
    );
    continue when not v_all_closed;

    for e in select * from public.enrollments where cohort_id = c.id and status = 'active' loop
      select count(*) into v_green from public.day_status where enrollment_id = e.id and status = 'green';
      -- Plus longue série de jours non verts.
      select coalesce(max(n), 0) into v_worst from (
        select count(*) as n from (
          select d::date as day,
            d::date - (row_number() over (order by d))::int as grp
          from generate_series(greatest(c.start_date, e.started_on)::timestamp, c.end_date::timestamp, interval '1 day') d
          where not exists (select 1 from public.day_status ds
            where ds.enrollment_id = e.id and ds.day = d::date and ds.status = 'green')
        ) t group by grp
      ) runs;

      if v_green >= 75 and v_worst <= 3 then
        update public.enrollments set status = 'completed', closed_at = now() where id = e.id;
        perform public._award(e.id, e.user_id, c.end_date, 500, 'arc_completed', e.id);
        perform public._check_achievements(e.id);
        v_completed := v_completed || jsonb_build_object('enrollment_id', e.id, 'user_id', e.user_id,
          'email', (select u.email from auth.users u where u.id = e.user_id), 'cohort', c.name,
          'green', v_green, 'stake_payment_intent_id', case when e.stake_status = 'held' then e.stake_payment_intent_id end);
      else
        update public.enrollments
        set status = 'failed', closed_at = now(),
            stake_status = case when stake_status = 'held' then 'forfeited' else stake_status end
        where id = e.id;
        v_failed := v_failed || jsonb_build_object('enrollment_id', e.id, 'user_id', e.user_id,
          'email', (select u.email from auth.users u where u.id = e.user_id), 'cohort', c.name, 'green', v_green);
      end if;
    end loop;

    update public.enrollments set stake_status = 'forfeited'
    where cohort_id = c.id and status = 'abandoned' and stake_status = 'held';
    update public.enrollments set closed_at = now() where cohort_id = c.id and closed_at is null and status <> 'pending_payment';
    update public.cohorts set closed_at = now() where id = c.id;
  end loop;
  return jsonb_build_object('completed', v_completed, 'failed', v_failed);
end;
$$;

create function public.set_loyalty_code(p_enrollment uuid, p_code text) returns void
language sql security definer set search_path = '' as $$
  update public.enrollments set loyalty_code = p_code where id = p_enrollment and loyalty_code is null;
$$;

create function public.mark_stake(p_enrollment uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('refunded', 'forfeited') then
    raise exception 'Statut invalide.';
  end if;
  update public.enrollments set stake_status = p_status where id = p_enrollment and stake_status = 'held';
end;
$$;

-- Rappel de 18 h 30 : ceux qui ont encore des principes à prouver aujourd'hui, un seul rappel par jour.
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
  join public.cohorts c on c.id = e.cohort_id
  join public.profiles pr on pr.id = e.user_id
  join public.principles p on p.enrollment_id = e.id
  where e.status = 'active'
    and public.paris_today() between greatest(c.start_date, e.started_on) and c.end_date
    and public._is_scheduled(p.days, public.paris_today())
    and not exists (select 1 from public.validations v where v.principle_id = p.id and v.day = public.paris_today())
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

-- Récapitulatif du lundi : la semaine écoulée.
create function public.weekly_recap_targets()
returns table (user_id uuid, email text, email_reminders boolean, points int, green int, days int, challenge text,
  challenge_status text, level int)
language sql stable security definer set search_path = '' as $$
  select e.user_id,
    (select u.email from auth.users u where u.id = e.user_id),
    pr.email_reminders,
    coalesce((select sum(l.delta) from public.points_ledger l where l.enrollment_id = e.id
      and l.day between public._week_monday(public.paris_today()) - 7 and public._week_monday(public.paris_today()) - 1), 0)::int,
    (select count(*) from public.day_status d where d.enrollment_id = e.id and d.status = 'green'
      and d.day between public._week_monday(public.paris_today()) - 7 and public._week_monday(public.paris_today()) - 1)::int,
    (select count(*) from public.day_status d where d.enrollment_id = e.id
      and d.day between public._week_monday(public.paris_today()) - 7 and public._week_monday(public.paris_today()) - 1)::int,
    (select ch.title from public.challenge_assignments a join public.challenges ch on ch.id = a.challenge_id
      where a.enrollment_id = e.id and a.week = public._arc_week(c.start_date, public.paris_today() - 7)),
    (select a.status from public.challenge_assignments a
      where a.enrollment_id = e.id and a.week = public._arc_week(c.start_date, public.paris_today() - 7)),
    e.level
  from public.enrollments e
  join public.cohorts c on c.id = e.cohort_id
  join public.profiles pr on pr.id = e.user_id
  where e.status = 'active'
    and public.paris_today() - 7 between greatest(c.start_date, e.started_on) and c.end_date;
$$;

-- Photos de plus de 30 jours (et dépôts orphelins) à supprimer du stockage.
create function public.cron_photo_cleanup_targets() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(o.name), '{}')
  from storage.objects o
  where o.bucket_id = 'proofs'
    and (o.created_at < now() - interval '30 days'
      or (o.created_at < now() - interval '1 day'
        and not exists (select 1 from public.validations v where v.photo_path = o.name)
        and not exists (select 1 from public.audits a where a.photo_path = o.name)
        and not exists (select 1 from public.challenge_proofs cp where cp.photo_path = o.name)));
$$;

create function public.mark_photos_deleted(p_paths text[]) returns void
language sql security definer set search_path = '' as $$
  update public.validations set photo_deleted_at = now() where photo_path = any(p_paths) and photo_deleted_at is null;
  update public.audits set photo_deleted_at = now() where photo_path = any(p_paths) and photo_deleted_at is null;
  update public.challenge_proofs set photo_deleted_at = now() where photo_path = any(p_paths) and photo_deleted_at is null;
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
grant execute on function public.cohort_signups(uuid) to anon, authenticated, service_role;
grant execute on function public.cohort_stats(uuid) to anon, authenticated, service_role;
grant execute on function public.leaderboard(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.achievement_rarity(uuid) to anon, authenticated, service_role;
grant execute on function public.public_profile(text) to anon, authenticated, service_role;

-- Utilisateur connecté
grant execute on function public.create_enrollment(text, int, boolean, boolean, text, text, boolean, text[], text, text, uuid) to authenticated;
grant execute on function public.set_custom_principle(text, text) to authenticated;
grant execute on function public.remove_custom_principle() to authenticated;
grant execute on function public.claim_presale() to authenticated;
grant execute on function public.validate_declaratif(uuid) to authenticated;
grant execute on function public.validate_link(uuid, text) to authenticated;
grant execute on function public.start_proof_session(uuid) to authenticated;
grant execute on function public.heartbeat(uuid, text, boolean, int) to authenticated;
grant execute on function public.abandon_session(uuid, text) to authenticated;
grant execute on function public.complete_session(uuid, text) to authenticated;
grant execute on function public.complete_reps(uuid, text, jsonb) to authenticated;
grant execute on function public.complete_wake_check(uuid, text, text) to authenticated;
grant execute on function public.validate_challenge_declaratif(uuid) to authenticated;
grant execute on function public.validate_challenge_link(uuid, text) to authenticated;
grant execute on function public.start_challenge_session(uuid, int) to authenticated;
grant execute on function public.my_dashboard() to authenticated;
grant execute on function public.day_detail(date) to authenticated;
grant execute on function public.my_profile() to authenticated;
grant execute on function public.update_profile_settings(boolean, text, boolean) to authenticated;
grant execute on function public.new_achievements() to authenticated;
grant execute on function public.mark_achievements_seen() to authenticated;
grant execute on function public.mark_level_seen() to authenticated;
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
grant execute on function public.admin_save_cohort(uuid, text, date, boolean, int, int, boolean) to authenticated;
grant execute on function public.admin_stakes() to authenticated;
grant execute on function public.admin_mark_stake_donated(uuid) to authenticated;
grant execute on function public.admin_log(text, text, jsonb) to authenticated;
grant execute on function public.admin_recent_log() to authenticated;

-- Serveur uniquement (clé service_role)
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
grant execute on function public.activate_paid_enrollment(uuid, text, int, text, text, text) to service_role;
grant execute on function public.record_stake(uuid, text, int) to service_role;
grant execute on function public.set_referral_promo(uuid, text) to service_role;
grant execute on function public.validate_photo(uuid, uuid, text) to service_role;
grant execute on function public.validate_challenge_photo(uuid, uuid, text) to service_role;
grant execute on function public.submit_audit_photo(uuid, uuid, text) to service_role;
grant execute on function public.cron_expire_sessions() to service_role;
grant execute on function public.cron_close_days() to service_role;
grant execute on function public.cron_expire_audits() to service_role;
grant execute on function public.cron_weekly() to service_role;
grant execute on function public.cron_cohort_end() to service_role;
grant execute on function public.set_loyalty_code(uuid, text) to service_role;
grant execute on function public.mark_stake(uuid, text) to service_role;
grant execute on function public.cron_reminder_targets() to service_role;
grant execute on function public.mark_reminded(uuid, text) to service_role;
grant execute on function public.push_targets(uuid) to service_role;
grant execute on function public.delete_push_endpoint(text) to service_role;
grant execute on function public.weekly_recap_targets() to service_role;
grant execute on function public.cron_photo_cleanup_targets() to service_role;
grant execute on function public.mark_photos_deleted(text[]) to service_role;
grant execute on function public.set_audit_rate(numeric) to service_role;
grant execute on function public.cleanup_rate_limits() to service_role;
