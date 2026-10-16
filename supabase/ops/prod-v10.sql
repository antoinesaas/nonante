-- Production : v10 (barème doux, remise à 0 à −500, calcul mental au réveil, classement), à coller dans l'éditeur SQL de Supabase.
begin;
-- V10 (16 octobre 2026) : barème plus doux, remise à zéro à −500, calcul mental au réveil, classement plus parlant.
-- 1. Un principe raté coûte sa valeur, rien de plus (fini le double et le triple, jour blanc compris).
-- 2. Quand le total d'un joueur tombe à −500, il repart à 0 (ligne « reset » du registre, jamais comptée en XP
--    ni dans les points de la semaine, du mois ou du jour).
-- 3. Le réveil se prouve avec trois questions de calcul mental adaptées au niveau d'études, à la place du code à
--    recopier. Chaque bonne réponse rapporte un bonus (+5), une erreur ne coûte rien. Suivi dans le carnet de notes.
-- 4. Le classement donne aussi l'activité (business) de chaque joueur public.

alter table public.points_ledger drop constraint if exists points_ledger_reason_check;
alter table public.points_ledger add constraint points_ledger_reason_check check (reason in (
  'validation', 'missed', 'session_broken', 'audit_failed', 'challenge', 'challenge_audit_failed',
  'perfect_week', 'achievement', 'arc_completed', 'wallet', 'wallet_audit_failed', 'grade', 'reset', 'mental_math'
));

-- Points : −500, et le compteur repart de zéro.
create or replace function public._award(p_enrollment uuid, p_user uuid, p_day date, p_delta int, p_reason text, p_ref uuid)
returns boolean
language plpgsql set search_path = '' as $$
declare
  v_total int;
begin
  if p_delta = 0 then
    return false;
  end if;
  insert into public.points_ledger (enrollment_id, user_id, day, delta, reason, ref_id)
  values (p_enrollment, p_user, p_day, p_delta, p_reason, p_ref)
  on conflict (reason, ref_id) do nothing;
  if not found then
    return false;
  end if;
  if p_delta < 0 then
    select coalesce(sum(delta), 0) into v_total from public.points_ledger where user_id = p_user;
    if v_total <= -500 then
      insert into public.points_ledger (enrollment_id, user_id, day, delta, reason, ref_id)
      values (p_enrollment, p_user, p_day, -v_total, 'reset', gen_random_uuid());
    end if;
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Calcul mental
-- ---------------------------------------------------------------------------
create table if not exists public.mental_math (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  session_id uuid unique references public.proof_sessions (id) on delete set null,
  day date not null,
  level int not null check (level between 1 and 3),
  questions jsonb not null,
  correct int not null check (correct between 0 and 3),
  total int not null default 3,
  points int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists mental_math_user_day_idx on public.mental_math (user_id, day);
alter table public.mental_math enable row level security;
drop policy if exists "mental_math : lecture des siens" on public.mental_math;
create policy "mental_math : lecture des siens" on public.mental_math
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.mental_math from anon, authenticated;
grant select on public.mental_math to authenticated;

create or replace function public._rand(p_lo int, p_hi int) returns int
language sql volatile set search_path = '' as $$
  select p_lo + floor(random() * (p_hi - p_lo + 1))::int;
$$;

-- Niveau : 1 lycée, 3 prépa et écoles d'ingénieurs, 2 pour le reste (université, commerce, BTS/BUT, business).
create or replace function public._math_level(p_school text) returns int
language sql immutable set search_path = '' as $$
  select case when p_school = 'lycee' then 1 when p_school in ('prepa', 'ingenieur') then 3 else 2 end;
$$;

-- Trois questions, une de chaque sorte, réponses entières. op : + - x / % (b % de a) sq (a au carré).
create or replace function public._math_questions(p_level int) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_op text;
  a int;
  b int;
  v_ans int;
begin
  for v_op in
    select o from unnest(case p_level when 1 then array['+', '-', 'x'] when 2 then array['x', '/', '%']
      else array['x', 'sq', '%'] end) o order by random()
  loop
    if p_level = 1 then
      if v_op = '+' then a := public._rand(12, 89); b := public._rand(12, 89); v_ans := a + b;
      elsif v_op = '-' then a := public._rand(40, 99); b := public._rand(11, a - 11); v_ans := a - b;
      else a := public._rand(3, 10); b := public._rand(3, 10); v_ans := a * b;
      end if;
    elsif p_level = 2 then
      if v_op = 'x' then a := public._rand(12, 49); b := public._rand(3, 9); v_ans := a * b;
      elsif v_op = '/' then b := public._rand(3, 12); v_ans := public._rand(6, 25); a := b * v_ans;
      else b := (array[10, 20, 25, 50, 75])[public._rand(1, 5)]; a := 20 * public._rand(2, 20); v_ans := a * b / 100;
      end if;
    else
      if v_op = 'x' then a := public._rand(13, 39); b := public._rand(13, 39); v_ans := a * b;
      elsif v_op = 'sq' then a := public._rand(11, 25); b := 2; v_ans := a * a;
      else b := (array[5, 15, 30, 35, 45])[public._rand(1, 5)]; a := 20 * public._rand(3, 40); v_ans := a * b / 100;
      end if;
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('a', a, 'op', v_op, 'b', b, 'answer', v_ans));
  end loop;
  return v_out;
end;
$$;

-- Ce que voit le joueur : les questions sans les réponses.
create or replace function public._math_public(p_questions jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(q - 'answer' order by n), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) with ordinality as x(q, n);
$$;

-- Réveil : les trois réponses. Le réveil est prouvé dès qu'on répond à temps ; chaque bonne réponse = +5.
create or replace function public.complete_wake_quiz(p_session_id uuid, p_nonce text, p_answers int[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  s public.proof_sessions;
  p public.principles;
  ch public.challenges;
  v_before time;
  v_questions jsonb;
  v_checked jsonb := '[]'::jsonb;
  v_correct int := 0;
  v_points int;
  v_mm uuid;
  v_result jsonb;
  q jsonb;
  i int := 0;
begin
  select * into s from public.proof_sessions where id = p_session_id for update;
  if s.id is null or s.user_id <> v_user or s.nonce <> p_nonce or s.kind <> 'reveil' then
    raise exception 'Session introuvable.';
  end if;
  if s.status <> 'running' then
    return jsonb_build_object('status', s.status);
  end if;
  v_questions := s.data -> 'questions';
  if v_questions is null then
    raise exception 'Session introuvable.';
  end if;
  if p_answers is null or cardinality(p_answers) <> jsonb_array_length(v_questions)
    or exists (select 1 from unnest(p_answers) x where x is null) then
    raise exception 'Réponds aux trois questions.';
  end if;
  if s.principle_id is not null then
    select * into p from public.principles where id = s.principle_id;
    v_before := (p.target ->> 'before')::time;
  else
    select ch2.* into ch from public.challenges ch2
    join public.challenge_assignments a on a.challenge_id = ch2.id
    where a.id = s.challenge_assignment_id;
    v_before := (ch.rule ->> 'before')::time;
  end if;
  if now() - s.started_at > interval '10 minutes' or public.paris_now() > s.day + v_before then
    update public.proof_sessions set status = 'expired', ended_at = now() where id = s.id;
    return jsonb_build_object('status', 'expired', 'reason', 'Trop tard.');
  end if;

  for q in select x from jsonb_array_elements(v_questions) x loop
    i := i + 1;
    if (q ->> 'answer')::int = p_answers[i] then
      v_correct := v_correct + 1;
    end if;
    v_checked := v_checked || jsonb_build_array(q || jsonb_build_object('given', p_answers[i],
      'correct', (q ->> 'answer')::int = p_answers[i]));
  end loop;
  v_points := 5 * v_correct;

  update public.proof_sessions set status = 'completed', ended_at = now() where id = s.id;
  insert into public.mental_math (user_id, enrollment_id, session_id, day, level, questions, correct, total, points)
  values (s.user_id, s.enrollment_id, s.id, s.day, coalesce((s.data ->> 'level')::int, 2), v_checked, v_correct,
    jsonb_array_length(v_questions), v_points)
  returning id into v_mm;
  perform public._award(s.enrollment_id, s.user_id, s.day, v_points, 'mental_math', v_mm);

  if s.principle_id is not null then
    v_result := public._create_validation(s.user_id, s.principle_id, s.day, 'reveil', 'forte', s.id, null, null);
  else
    perform public._evaluate_assignment(s.challenge_assignment_id, false);
    perform public._after_change(s.user_id);
  end if;
  return jsonb_build_object('status', 'completed', 'validation', v_result, 'correct', v_correct,
    'total', jsonb_array_length(v_questions), 'bonus', v_points, 'questions', v_checked);
end;
$$;

-- Suivi du calcul mental (carnet de notes) : les 60 derniers jours, question par question.
create or replace function public.my_mental_math() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'level', public._math_level((select en.school from public.enrollments en where en.user_id = (select auth.uid())
      and en.status <> 'draft' order by en.arc_number desc limit 1)),
    'quizzes', count(*)::int,
    'correct', coalesce(sum(mm.correct), 0)::int,
    'total', coalesce(sum(mm.total), 0)::int,
    'points', coalesce(sum(mm.points), 0)::int,
    'entries', coalesce(jsonb_agg(jsonb_build_object('id', mm.id, 'day', mm.day, 'level', mm.level,
      'questions', mm.questions, 'correct', mm.correct, 'total', mm.total, 'points', mm.points)
      order by mm.day desc, mm.created_at desc), '[]'::jsonb)
  )
  from public.mental_math mm
  where mm.user_id = (select auth.uid()) and mm.day >= public.paris_today() - 59;
$$;

-- Classement : l'activité de chaque joueur (business) en plus, et rien de la remise à zéro dans la semaine ou le mois.
drop function if exists public.leaderboard(text, text, uuid);
create function public.leaderboard(p_period text default 'semaine', p_category text default null, p_squad uuid default null)
returns table (rank int, pseudo text, avatar_path text, level int, ovr int, category text, country text, points int,
  streak int, is_me boolean, is_public boolean, business text[], business_other text)
language sql stable security definer set search_path = '' as $$
  with allowed as (
    select p_squad is null or exists (
      select 1 from public.squads sq where sq.id = p_squad and (sq.is_public or sq.is_official or exists (
        select 1 from public.squad_members m where m.squad_id = sq.id and m.user_id = auth.uid()))
    ) as ok
  ),
  since as (
    select case p_period
      when 'semaine' then public._week_monday(public.paris_today())
      when 'mois' then date_trunc('month', public.paris_today())::date
    end as day
  ),
  players as (
    select pr.id, pr.pseudo, pr.is_public, pr.avatar_path, pr.country, ps.level, ps.ovr, ps.streak,
      en.category, en.business_types, en.business_other
    from public.profiles pr
    join public.player_stats ps on ps.user_id = pr.id
    cross join lateral (
      select x.category, x.business_types, x.business_other from public.enrollments x
      where x.user_id = pr.id and x.status <> 'draft' order by x.arc_number desc limit 1
    ) en
    where (p_squad is null or exists (select 1 from public.squad_members m where m.squad_id = p_squad and m.user_id = pr.id))
      and (select ok from allowed)
  ),
  scored as (
    select pl.*, coalesce((select sum(l.delta) from public.points_ledger l where l.user_id = pl.id
      and ((select day from since) is null or (l.day >= (select day from since) and l.reason <> 'reset'))), 0)::int as points
    from players pl
    where p_category is null or pl.category = p_category
  )
  select (rank() over (order by s.points desc, s.streak desc, s.ovr desc))::int,
    case when s.is_public then s.pseudo else 'Anonyme' end,
    case when s.is_public then s.avatar_path end,
    s.level, s.ovr, s.category, s.country, s.points, s.streak,
    coalesce(s.id = auth.uid(), false),
    s.is_public,
    case when s.is_public then s.business_types else '{}'::text[] end,
    case when s.is_public then s.business_other end
  from scored s
  order by 1, s.streak desc
  limit 500;
$$;


-- Clôture d'une journée : un principe raté coûte sa valeur, rien de plus.
create or replace function public.close_day(p_enrollment uuid, p_day date) returns text
language plpgsql set search_path = '' as $$
declare
  e public.enrollments;
  p public.principles;
  v_opened boolean;
  v_white boolean;
  v_all_ok boolean := true;
  v_any boolean := false;
  v_prev_day date;
  v_prev_streak int;
  v_streak int;
  v_mult int;
  v_value int;
  v_status text;
  v_assignment uuid;
  v_week_end boolean;
begin
  select * into e from public.enrollments where id = p_enrollment for update;
  if e.id is null or e.status <> 'active' then
    return 'skipped';
  end if;
  if p_day < e.start_date or p_day > e.end_date or p_day >= public.paris_today() then
    return 'skipped';
  end if;
  if exists (select 1 from public.day_status where enrollment_id = e.id and day = p_day) then
    return 'done';
  end if;
  -- Une session commencée ce jour-là tourne encore : on attendra la prochaine exécution.
  if exists (select 1 from public.proof_sessions where enrollment_id = e.id and day = p_day and status = 'running') then
    return 'deferred';
  end if;

  v_opened := exists (select 1 from public.app_opens where enrollment_id = e.id and day = p_day)
    or exists (select 1 from public.validations where enrollment_id = e.id and day = p_day);

  if exists (select 1 from public.joker_days where enrollment_id = e.id and day = p_day) then
    v_status := 'joker';
  else
    v_white := not v_opened;
    for p in
      select * from public.principles
      where enrollment_id = e.id and public._on_day(active_from, active_until, days, p_day)
      order by position
    loop
      v_any := true;
      if exists (
        select 1 from public.validations
        where principle_id = p.id and day = p_day and status in ('valid', 'audit_pending')
      ) then
        continue;
      end if;
      v_all_ok := false;
      -- Validation refusée au contrôle : la pénalité du contrôle suffit.
      if exists (select 1 from public.validations where principle_id = p.id and day = p_day) then
        continue;
      end if;

      -- Occurrence précédente du même principe (même position, toutes versions, sur 7 jours) : ratée aussi ?
      select max(d)::date into v_prev_day
      from generate_series(greatest(e.start_date, p_day - 7)::timestamp, (p_day - 1)::timestamp, interval '1 day') d
      where exists (
        select 1 from public.principles pp
        where pp.enrollment_id = e.id and pp.position = p.position
          and public._on_day(pp.active_from, pp.active_until, pp.days, d::date)
      ) and not exists (select 1 from public.joker_days j where j.enrollment_id = e.id and j.day = d::date);
      v_prev_streak := 0;
      if v_prev_day is not null then
        select m.streak into v_prev_streak from public.misses m
        join public.principles pp on pp.id = m.principle_id
        where pp.enrollment_id = e.id and pp.position = p.position and m.day = v_prev_day;
        v_prev_streak := coalesce(v_prev_streak, 0);
      end if;
      v_streak := v_prev_streak + 1;
      -- V10 : on perd seulement la valeur du principe non validé (plus de double ni de triple).
      v_mult := 1;
      v_value := 10 * p.difficulty;

      insert into public.misses (principle_id, day, enrollment_id, streak, white, points)
      values (p.id, p_day, e.id, v_streak, v_white, -v_mult * v_value);
      perform public._award(e.id, e.user_id, p_day, -v_mult * v_value, 'missed',
        public._ref('missed:' || p.id || ':' || p_day));
    end loop;

    v_status := case
      when not v_any then 'green'
      when v_white then 'white'
      when v_all_ok then 'green'
      else 'red'
    end;
  end if;
  insert into public.day_status (enrollment_id, day, status, opened_app) values (e.id, p_day, v_status, v_opened);

  -- Fin d'une semaine de l'arc (7 jours depuis le jour 1) : semaine parfaite et quête jugée.
  v_week_end := ((p_day - e.start_date + 1) % 7 = 0) or p_day = e.end_date;
  if v_week_end then
    if (p_day - e.start_date + 1) % 7 = 0 and (
      select count(*) from public.day_status
      where enrollment_id = e.id and day between p_day - 6 and p_day and status = 'green'
    ) = 7 then
      perform public._award(e.id, e.user_id, p_day, 50, 'perfect_week', public._ref('perfect_week:' || e.id || ':' || p_day));
    end if;
    for v_assignment in
      select id from public.challenge_assignments
      where enrollment_id = e.id and status = 'assigned' and week <= public._arc_week(e.start_date, p_day)
    loop
      perform public._evaluate_assignment(v_assignment, true);
    end loop;
  else
    for v_assignment in
      select a.id from public.challenge_assignments a
      join public.challenges ch on ch.id = a.challenge_id
      where a.enrollment_id = e.id and a.status = 'assigned' and ch.rule ->> 'type' in ('green_day', 'green_days')
    loop
      perform public._evaluate_assignment(v_assignment, false);
    end loop;
  end if;

  -- Abandon : 7 jours blancs d'affilée.
  if (
    select count(*) from (
      select status from public.day_status where enrollment_id = e.id order by day desc limit 7
    ) last7 where last7.status = 'white'
  ) = 7 then
    update public.enrollments set status = 'abandoned', closed_at = now() where id = e.id;
  elsif p_day = e.end_date then
    perform public._finish_arc(e.id);
  end if;

  perform public._after_change(e.user_id);
  return 'closed';
end;
$$;

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
  if exists (select 1 from public.validations where principle_id = p.id and day = v_today) then
    raise exception 'Déjà validé aujourd''hui.';
  end if;

  if p.proof_type = 'session' then
    v_minutes := (p.target ->> 'minutes')::int;
    if p.target ? 'before' and v_now + make_interval(mins => v_minutes) > v_today + (p.target ->> 'before')::time then
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
    'started_at', s.started_at, 'server_now', now(), 'code', null, 'questions', public._math_public(v_data -> 'questions'), 'target', p.target
  );
end;
$$;

create or replace function public.start_challenge_session(p_assignment_id uuid, p_minutes int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  a public.challenge_assignments := public._current_assignment(v_user, p_assignment_id);
  ch public.challenges;
  v_today date := public.paris_today();
  v_now timestamp := public.paris_now();
  v_before time;
  v_code text;
  v_data jsonb := '{}';
  v_nonce text := public._nonce();
  s public.proof_sessions;
begin
  select * into ch from public.challenges where id = a.challenge_id;
  if ch.proof_type not in ('session', 'reps', 'reveil') then
    raise exception 'Cette quête demande une autre preuve.';
  end if;
  if ch.proof_type = 'session' and (p_minutes is null or p_minutes not in (25, 50, 90)) then
    raise exception 'Durée invalide.';
  end if;
  if ch.proof_type = 'reveil' then
    v_before := (ch.rule ->> 'before')::time;
    if ch.rule ? 'isodow' and extract(isodow from v_today)::int <> (ch.rule ->> 'isodow')::int then
      raise exception 'Ce n''est pas le bon jour pour cette quête.';
    end if;
    if v_now < v_today + v_before - interval '2 hours 30 minutes' or v_now > v_today + v_before then
      raise exception 'Ce réveil se prouve entre % et %.',
        public._time_fr(v_before - interval '2 hours 30 minutes'), public._time_fr(v_before);
    end if;
    -- V10 : trois questions de calcul mental, selon le niveau d'études, à la place du code.
    v_data := jsonb_build_object('level', public._math_level((select en.school from public.enrollments en where en.id = a.enrollment_id)));
    v_data := v_data || jsonb_build_object('questions', public._math_questions((v_data ->> 'level')::int));
  elsif ch.proof_type = 'reps' then
    v_data := jsonb_build_object('exercise', coalesce(ch.rule ->> 'exercise', 'pushup'));
  end if;

  perform public._settle_user_sessions(v_user);
  if exists (select 1 from public.proof_sessions where user_id = v_user and status = 'running') then
    raise exception 'Une session est déjà en cours.';
  end if;

  insert into public.proof_sessions (user_id, enrollment_id, challenge_assignment_id, kind, nonce, day, minutes, data)
  values (v_user, a.enrollment_id, a.id, ch.proof_type, v_nonce, v_today,
    case when ch.proof_type = 'session' then p_minutes end, v_data)
  returning * into s;

  return jsonb_build_object(
    'id', s.id, 'nonce', v_nonce, 'kind', s.kind, 'minutes', s.minutes,
    'started_at', s.started_at, 'server_now', now(), 'code', null, 'questions', public._math_public(v_data -> 'questions'), 'target', ch.rule
  );
end;
$$;

-- XP : la remise à zéro n'est pas un gain ; le calcul mental nourrit l'Esprit.
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

create or replace function public.my_dashboard() returns jsonb
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
        'assignment_id', a.id, 'code', ch.code, 'week', a.week, 'status', a.status, 'title', ch.title,
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
      where user_id = v_user and day >= public._week_monday(v_today) and reason <> 'reset'),
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
          from public.misses m where m.principle_id = p.id and m.day = p_day)
      ) order by p.position), '[]'::jsonb)
      from public.principles p
      where p.enrollment_id = e.id and public._on_day(p.active_from, p.active_until, p.days, p_day)
    )
  );
end;
$$;


-- Rattrapage : les joueurs déjà à −500 ou moins repartent de zéro.
do $$
declare
  r record;
begin
  for r in
    select l.user_id, sum(l.delta)::int as total,
      (select en.id from public.enrollments en where en.user_id = l.user_id order by en.arc_number desc limit 1) as enrollment_id
    from public.points_ledger l group by l.user_id having sum(l.delta) <= -500
  loop
    insert into public.points_ledger (enrollment_id, user_id, day, delta, reason, ref_id)
    values (r.enrollment_id, r.user_id, public.paris_today(), -r.total, 'reset', gen_random_uuid());
  end loop;
end;
$$;

revoke execute on function public._rand(int, int), public._math_level(text), public._math_questions(int),
  public._math_public(jsonb) from public, anon, authenticated;
revoke execute on function public.complete_wake_quiz(uuid, text, int[]), public.my_mental_math() from public, anon;
grant execute on function public.complete_wake_quiz(uuid, text, int[]), public.my_mental_math() to authenticated;
revoke execute on function public.leaderboard(text, text, uuid) from public;
grant execute on function public.leaderboard(text, text, uuid) to anon, authenticated, service_role;

commit;
