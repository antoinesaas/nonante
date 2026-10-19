-- V14 (19 octobre 2026) : un minuteur déjà validé se refait. Chaque session tenue en plus rapporte une
-- « session bonus » : 10 × difficulté de la session (≤ 25 min → 10, ≤ 50 min → 20, au-delà → 30), 3 bonus au plus
-- par jour (contre l'enchaînement de sessions courtes pour le classement). Une session bonus cassée coûte − 5
-- comme les autres. Le bonus compte dans les points, l'XP et la stat du pilier, jamais dans la couleur du jour.

alter table public.points_ledger drop constraint if exists points_ledger_reason_check;
alter table public.points_ledger add constraint points_ledger_reason_check check (reason in (
  'validation', 'missed', 'session_broken', 'audit_failed', 'challenge', 'challenge_audit_failed',
  'perfect_week', 'achievement', 'arc_completed', 'wallet', 'wallet_audit_failed', 'grade', 'reset', 'mental_math',
  'session_bonus'
));

-- XP des sessions bonus d'un pilier sur une période.
create or replace function public._bonus_xp(p_user uuid, p_pillar text, p_from date, p_to date) returns int
language sql stable set search_path = '' as $$
  select coalesce(sum(l.delta), 0)::int
  from public.points_ledger l
  join public.proof_sessions s on s.id = l.ref_id
  join public.principles p on p.id = s.principle_id
  where l.user_id = p_user and l.reason = 'session_bonus' and l.day between p_from and p_to and p.pillar = p_pillar;
$$;
revoke execute on function public._bonus_xp(uuid, text, date, date) from public, anon, authenticated;

create or replace function public.start_proof_session(p_principle_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_today date := public.paris_today();
  v_now timestamp := public.paris_now();
  p public.principles;
  e public.enrollments;
  v_minutes int;
  v_before time;
  v_code text;
  v_data jsonb := '{}';
  v_nonce text := public._nonce();
  s public.proof_sessions;
  v_bonus boolean;
begin
  p := public._owned_principle(v_user, p_principle_id);
  select * into e from public.enrollments where id = p.enrollment_id;
  if p.proof_type not in ('session', 'reps', 'reveil') then
    raise exception 'Ce principe demande une autre preuve.';
  end if;
  if e.status <> 'active' or v_today < e.start_date or v_today > e.end_date then
    raise exception 'Ton arc n''a pas lieu aujourd''hui.';
  end if;
  if public._plan(v_user) is null then
    raise exception 'Ton abonnement est inactif : réactive-le pour valider.';
  end if;
  if not public._on_day(p.active_from, p.active_until, p.days, v_today) then
    raise exception 'Ce principe n''est pas prévu aujourd''hui.';
  end if;
  -- V14 : un minuteur déjà validé se refait (session bonus) ; les autres preuves, une fois par jour.
  v_bonus := exists (select 1 from public.validations where principle_id = p.id and day = v_today);
  if v_bonus and p.proof_type <> 'session' then
    raise exception 'Déjà validé aujourd''hui.';
  end if;

  if p.proof_type = 'session' then
    v_minutes := (p.target ->> 'minutes')::int;
    if v_bonus then
      v_data := jsonb_build_object('bonus', true);
    end if;
    if not v_bonus and p.target ? 'before' and v_now + make_interval(mins => v_minutes) > v_today + (p.target ->> 'before')::time then
      raise exception 'Trop tard : cette session doit finir avant %.', public._time_fr((p.target ->> 'before')::time);
    end if;
  elsif p.proof_type = 'reveil' then
    v_before := (p.target ->> 'before')::time;
    -- Fenêtre de 2 h 30 avant l'heure de lever : valider à minuit n'est pas se lever.
    if v_now < v_today + v_before - interval '2 hours 30 minutes' or v_now > v_today + v_before then
      raise exception 'Le réveil se prouve entre % et %.',
        public._time_fr(v_before - interval '2 hours 30 minutes'), public._time_fr(v_before);
    end if;
    -- V10 : trois questions de calcul mental, selon le niveau d'études, à la place du code.
    v_data := jsonb_build_object('level', public._math_level(e.school));
    v_data := v_data || jsonb_build_object('questions', public._math_questions((v_data ->> 'level')::int));
  else
    v_data := jsonb_build_object('exercise', coalesce(p.target ->> 'exercise', 'pushup'));
  end if;

  perform public._settle_user_sessions(v_user);
  if exists (select 1 from public.proof_sessions where user_id = v_user and status = 'running') then
    raise exception 'Une session est déjà en cours.';
  end if;

  insert into public.proof_sessions (user_id, enrollment_id, principle_id, kind, nonce, day, minutes, data)
  values (v_user, e.id, p.id, p.proof_type, v_nonce, v_today, v_minutes, v_data)
  returning * into s;

  return jsonb_build_object(
    'id', s.id, 'nonce', v_nonce, 'kind', s.kind, 'minutes', s.minutes,
    'started_at', s.started_at, 'server_now', now(), 'code', null, 'questions', public._math_public(v_data -> 'questions'), 'target', p.target,
    'bonus', v_bonus
  );
end;
$$;

create or replace function public.complete_session(p_session_id uuid, p_nonce text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  s public.proof_sessions;
  v_required int;
  v_expected int;
  v_result jsonb;
  v_value int;
begin
  select * into s from public.proof_sessions where id = p_session_id for update;
  if s.id is null or s.user_id <> v_user or s.nonce <> p_nonce or s.kind <> 'session' then
    raise exception 'Session introuvable.';
  end if;
  if s.status <> 'running' then
    return jsonb_build_object('status', s.status, 'reason', s.data ->> 'reason');
  end if;
  if now() - coalesce(s.last_heartbeat_at, s.started_at) > interval '45 seconds' then
    perform public._break_session(s.id, 'Les battements se sont arrêtés.');
    return jsonb_build_object('status', 'broken', 'reason', 'Les battements se sont arrêtés.');
  end if;
  v_required := s.minutes * 60;
  if extract(epoch from now() - s.started_at) < v_required then
    raise exception 'La session n''est pas terminée.';
  end if;
  -- Au moins 90 % des battements attendus (un toutes les 15 s).
  v_expected := floor(v_required / 15.0)::int;
  if s.heartbeats < ceil(0.9 * v_expected) then
    perform public._break_session(s.id, 'Trop peu de battements reçus.');
    return jsonb_build_object('status', 'broken', 'reason', 'Trop peu de battements reçus.');
  end if;

  update public.proof_sessions set status = 'completed', ended_at = now() where id = s.id;

  if s.principle_id is not null and exists (select 1 from public.validations where principle_id = s.principle_id and day = s.day) then
    -- V14 : session bonus. 10 × difficulté de la session, 3 au plus par jour (au-delà, tenue mais sans points).
    v_value := 10 * public._difficulty('session', jsonb_build_object('minutes', s.minutes), null);
    if (select count(*) from public.points_ledger where user_id = s.user_id and day = s.day and reason = 'session_bonus') >= 3 then
      v_value := 0;
    end if;
    perform public._award(s.enrollment_id, s.user_id, s.day, v_value, 'session_bonus', s.id);
    perform public._after_change(s.user_id);
    return jsonb_build_object('status', 'completed', 'bonus', v_value, 'capped', v_value = 0);
  elsif s.principle_id is not null then
    v_result := public._create_validation(s.user_id, s.principle_id, s.day, 'session', 'forte', s.id, null, null);
  elsif s.challenge_assignment_id is not null then
    perform public._evaluate_assignment(s.challenge_assignment_id, false);
    perform public._after_change(s.user_id);
  end if;
  return jsonb_build_object('status', 'completed', 'validation', v_result);
end;
$$;

create or replace function public.set_session_minutes(p_id uuid, p_minutes int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._open_enrollment(v_user);
  p public.principles;
  v_then text;
begin
  if p_minutes is null or not public._valid_minutes(p_minutes) then
    raise exception 'Durée invalide.';
  end if;
  select * into p from public.principles where id = p_id and enrollment_id = e.id;
  if e.id is null or p.id is null then
    raise exception 'Principe introuvable.';
  end if;
  if p.proof_type <> 'session' then
    raise exception 'Ce principe demande une autre preuve.';
  end if;
  if (p.target ->> 'minutes')::int = p_minutes then
    return p.id;
  end if;
  v_then := regexp_replace(p.then_text, '\d+(\s?(minutes|minute|min|Minuten|minutos)\y)', p_minutes::text || '\1');
  -- Principe déjà validé ou session déjà lancée aujourd'hui : la durée change sur place (v14 : sessions bonus). Chaque session garde sa
  -- propre durée, et la nouvelle version n'attend pas demain (avant, « Déjà validé » s'affichait à tort).
  if public._used_today(p.id) then
    update public.principles
       set target = jsonb_set(p.target, '{minutes}', to_jsonb(p_minutes)), then_text = v_then,
           difficulty = public._difficulty('session', jsonb_set(p.target, '{minutes}', to_jsonb(p_minutes)), p.difficulty)
     where id = p.id;
    return p.id;
  end if;
  return public._save_principle(v_user, p.id, p.pillar, p.if_text, v_then, p.proof_type,
    jsonb_set(p.target, '{minutes}', to_jsonb(p_minutes)), p.days, p.difficulty, null, null);
end;
$$;

create or replace function public._refresh_stats(p_user uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_today date := public.paris_today();
  v_from date := public.paris_today() - 29;
  e public.enrollments := public._current_enrollment(p_user);
  v_xp int;
  v_focus int;
  v_corps int;
  v_business int;
  v_esprit int;
  v_energie int;
  v_wallet_xp int;
  v_grade_xp int;
  v_math_xp int;
  v_closed int;
  v_good int;
  v_disc int;
  v_streak int := 0;
  v_best int;
  d record;
begin
  select coalesce(sum(delta) filter (where delta > 0 and reason <> 'reset'), 0) into v_xp from public.points_ledger where user_id = p_user;

  select
    coalesce(sum(v.points) filter (where v.pillar = 'focus'), 0),
    coalesce(sum(v.points) filter (where v.pillar = 'corps'), 0),
    coalesce(sum(v.points) filter (where v.pillar = 'business'), 0),
    coalesce(sum(v.points) filter (where v.pillar = 'esprit'), 0),
    coalesce(sum(v.points) filter (where v.pillar = 'energie'), 0)
  into v_focus, v_corps, v_business, v_esprit, v_energie
  from public.validations v join public.enrollments en on en.id = v.enrollment_id
  where en.user_id = p_user and v.day between v_from and v_today and v.status <> 'rejected';

  select coalesce(sum(delta), 0) into v_wallet_xp from public.points_ledger
  where user_id = p_user and reason = 'wallet' and day between v_from and v_today;
  v_business := v_business + v_wallet_xp;
  select coalesce(sum(delta), 0) into v_grade_xp from public.points_ledger
  where user_id = p_user and reason = 'grade' and day between v_from and v_today;
  v_esprit := v_esprit + v_grade_xp;
  select coalesce(sum(delta), 0) into v_math_xp from public.points_ledger
  where user_id = p_user and reason = 'mental_math' and day between v_from and v_today;
  v_esprit := v_esprit + v_math_xp;
  -- V14 : les sessions bonus nourrissent le pilier de leur principe.
  v_focus := v_focus + public._bonus_xp(p_user, 'focus', v_from, v_today);
  v_corps := v_corps + public._bonus_xp(p_user, 'corps', v_from, v_today);
  v_business := v_business + public._bonus_xp(p_user, 'business', v_from, v_today);
  v_esprit := v_esprit + public._bonus_xp(p_user, 'esprit', v_from, v_today);
  v_energie := v_energie + public._bonus_xp(p_user, 'energie', v_from, v_today);

  select count(*), count(*) filter (where ds.status in ('green', 'joker'))
  into v_closed, v_good
  from public.day_status ds join public.enrollments en on en.id = ds.enrollment_id
  where en.user_id = p_user and ds.day between v_from and v_today;
  v_disc := case when v_closed = 0 then 0 else round(99.0 * v_good / v_closed)::int end;

  -- Série : jours verts d'affilée jusqu'au dernier jour clos (un joker ne la casse pas).
  if e.id is not null then
    for d in select status from public.day_status where enrollment_id = e.id order by day desc loop
      if d.status = 'green' then
        v_streak := v_streak + 1;
      elsif d.status = 'joker' then
        continue;
      else
        exit;
      end if;
    end loop;
  end if;
  select greatest(coalesce(max(best_streak), 0), v_streak) into v_best from public.player_stats where user_id = p_user;

  insert into public.player_stats as ps (user_id, xp, level, level_seen, ovr, discipline, focus, corps, business, esprit,
    energie, streak, best_streak, green_days, focus_minutes, reps, wakes, wallet_proven_cents, wallet_declared_cents,
    arcs_completed, updated_at)
  select p_user, v_xp, public._level_for(v_xp), public._level_for(v_xp),
    round((v_disc + least(99, round(99.0 * v_focus / 600)) + least(99, round(99.0 * v_corps / 600))
      + least(99, round(99.0 * v_business / 600)) + least(99, round(99.0 * v_esprit / 600))
      + least(99, round(99.0 * v_energie / 600))) / 6.0)::int,
    v_disc,
    least(99, round(99.0 * v_focus / 600))::int,
    least(99, round(99.0 * v_corps / 600))::int,
    least(99, round(99.0 * v_business / 600))::int,
    least(99, round(99.0 * v_esprit / 600))::int,
    least(99, round(99.0 * v_energie / 600))::int,
    v_streak, v_best,
    (select count(*) from public.day_status ds join public.enrollments en on en.id = ds.enrollment_id
      where en.user_id = p_user and ds.status = 'green')::int,
    (select coalesce(sum(minutes), 0) from public.proof_sessions where user_id = p_user and kind = 'session' and status = 'completed')::int,
    (select coalesce(sum((data ->> 'count')::int), 0) from public.proof_sessions where user_id = p_user and kind = 'reps' and status = 'completed')::int,
    (select count(*) from public.proof_sessions where user_id = p_user and kind = 'reveil' and status = 'completed')::int,
    (select coalesce(sum(amount_cents), 0) from public.wallet_entries where user_id = p_user and status in ('proven', 'audit_pending')),
    (select coalesce(sum(amount_cents), 0) from public.wallet_entries where user_id = p_user and status = 'declared'),
    (select count(*) from public.enrollments where user_id = p_user and status = 'completed')::int,
    now()
  on conflict (user_id) do update set
    xp = excluded.xp, level = excluded.level, ovr = excluded.ovr, discipline = excluded.discipline,
    focus = excluded.focus, corps = excluded.corps, business = excluded.business, esprit = excluded.esprit,
    energie = excluded.energie, streak = excluded.streak, best_streak = excluded.best_streak,
    green_days = excluded.green_days, focus_minutes = excluded.focus_minutes, reps = excluded.reps,
    wakes = excluded.wakes, wallet_proven_cents = excluded.wallet_proven_cents,
    wallet_declared_cents = excluded.wallet_declared_cents, arcs_completed = excluded.arcs_completed,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.day_detail(p_day date) returns jsonb
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
    'points', (select coalesce(sum(delta), 0) from public.points_ledger where enrollment_id = e.id and day = p_day and reason <> 'reset'),
    'principles', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'then_text', p.then_text, 'proof_type', p.proof_type, 'pillar', p.pillar,
        'validation', (select jsonb_build_object('status', v.status, 'strength', v.strength, 'points', v.points)
          from public.validations v where v.principle_id = p.id and v.day = p_day),
        'miss', (select jsonb_build_object('points', m.points, 'streak', m.streak, 'white', m.white)
          from public.misses m where m.principle_id = p.id and m.day = p_day),
        'bonus', (select jsonb_build_object('count', count(*), 'points', coalesce(sum(l.delta), 0))
          from public.points_ledger l join public.proof_sessions s on s.id = l.ref_id
          where l.reason = 'session_bonus' and s.principle_id = p.id and l.day = p_day having count(*) > 0)
      ) order by p.position), '[]'::jsonb)
      from public.principles p
      where p.enrollment_id = e.id and public._on_day(p.active_from, p.active_until, p.days, p_day)
    )
  );
end;
$$;
