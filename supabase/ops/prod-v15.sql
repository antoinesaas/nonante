-- Production : v15 (calcul mental sur 10 niveaux), à coller dans l'éditeur SQL de Supabase.
begin;
-- V15 (20 octobre 2026) : calcul mental sur 10 niveaux.
-- 1. Point de départ selon les études (lycée 2, BTS/BUT 3, université, école de commerce 4, prépa et ingénieur 6,
--    sans études 3), ou choisi dans les réglages : débutant 1, intermédiaire 3, avancé 5, expert 8.
-- 2. Le niveau suit les résultats, un cran par jour au plus : 4 ou 5 bonnes réponses, il monte le lendemain ; 2 ou
--    moins, il redescend. Changer le réglage repart du point de départ choisi.
-- 3. Les anciens niveaux (1 à 3) deviennent 2, 4 et 6 dans l'historique.

alter table public.profiles add column if not exists math_mode text not null default 'auto'
  check (math_mode in ('auto', 'debutant', 'intermediaire', 'avance', 'expert'));
alter table public.profiles add column if not exists math_level int check (math_level between 1 and 10);

alter table public.mental_math drop constraint if exists mental_math_level_check;
update public.mental_math set level = case level when 1 then 2 when 2 then 4 else 6 end where level between 1 and 3;
alter table public.mental_math add constraint mental_math_level_check check (level between 1 and 10);

-- Point de départ : réglage du joueur, sinon ses études (arc le plus récent).
create or replace function public._math_base(p_user uuid) returns int
language sql stable set search_path = '' as $$
  select case pr.math_mode
    when 'debutant' then 1 when 'intermediaire' then 3 when 'avance' then 5 when 'expert' then 8
    else (select case
        when en.school is null then 3 when en.school = 'lycee' then 2 when en.school = 'bts_but' then 3
        when en.school in ('prepa', 'ingenieur') then 6 else 4 end
      from public.enrollments en where en.user_id = p_user and en.status <> 'draft'
      order by en.arc_number desc limit 1)
  end
  from public.profiles pr where pr.id = p_user;
$$;

-- Niveau du prochain calcul : celui atteint par les résultats, sinon le point de départ.
create or replace function public._math_level_for(p_user uuid) returns int
language sql stable set search_path = '' as $$
  select coalesce((select math_level from public.profiles where id = p_user), public._math_base(p_user), 3);
$$;

-- Réglage du joueur (paramètres du profil). Le niveau repart du nouveau point de départ.
create or replace function public.set_math_mode(p_mode text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
begin
  if p_mode is null or p_mode not in ('auto', 'debutant', 'intermediaire', 'avance', 'expert') then
    raise exception 'Niveau de calcul invalide.';
  end if;
  update public.profiles set math_mode = p_mode, math_level = null
   where id = v_user and math_mode is distinct from p_mode;
  return public._math_level_for(v_user);
end;
$$;

-- Cinq questions, réponses entières, du niveau 1 (tables, petites additions) au niveau 10 (deux chiffres × deux
-- chiffres, carrés jusqu'à 99², pourcentages impairs). op : + - x / % (b % de a) sq (a au carré).
create or replace function public._math_questions(p_level int) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare
  l int := least(10, greatest(1, coalesce(p_level, 3)));
  v_out jsonb := '[]'::jsonb;
  v_op text;
  a int;
  b int;
  v_ans int;
  -- Bornes par niveau (indice = niveau).
  add_lo int[] := array[10, 12, 100, 120, 150, 200, 300, 500, 1000, 2000];
  add_hi int[] := array[50, 89, 299, 499, 699, 899, 999, 1999, 4999, 9999];
  mul_a_lo int[] := array[2, 3, 6, 12, 15, 13, 21, 31, 41, 51];
  mul_a_hi int[] := array[6, 10, 12, 49, 60, 39, 59, 99, 99, 99];
  mul_b_lo int[] := array[2, 3, 6, 3, 4, 13, 11, 12, 21, 51];
  mul_b_hi int[] := array[6, 10, 12, 9, 9, 39, 29, 39, 59, 99];
  div_lo int[] := array[2, 2, 2, 3, 6, 12, 13, 13, 17, 23];
  div_hi int[] := array[5, 9, 12, 12, 15, 19, 25, 29, 39, 59];
  quo_lo int[] := array[2, 2, 3, 6, 10, 12, 13, 21, 25, 31];
  quo_hi int[] := array[10, 12, 15, 25, 30, 29, 40, 60, 99, 99];
  sq_lo int[] := array[4, 6, 9, 11, 11, 11, 15, 26, 31, 41];
  sq_hi int[] := array[9, 12, 15, 15, 19, 25, 35, 50, 75, 99];
  pct int[];
  pct_step int[] := array[20, 20, 20, 20, 20, 20, 20, 25, 100, 100];
  pct_lo int[] := array[1, 1, 1, 2, 2, 3, 5, 4, 2, 5];
  pct_hi int[] := array[10, 10, 20, 20, 30, 40, 50, 40, 50, 99];
begin
  pct := case l
    when 1 then array[10, 50] when 2 then array[10, 50] when 3 then array[10, 20, 25, 50]
    when 4 then array[10, 20, 25, 50, 75] when 5 then array[5, 15, 20, 25, 75] when 6 then array[5, 15, 30, 35, 45]
    when 7 then array[15, 35, 45, 65, 85] when 8 then array[12, 16, 24, 36, 48] when 9 then array[7, 13, 17, 23, 37]
    else array[3, 7, 13, 17, 23, 37, 43] end;
  for v_op in
    select o from unnest(case
      when l <= 3 then array['+', '-', 'x', '/', '%']
      when l <= 5 then array['x', '/', '%', '+', 'sq']
      when l <= 8 then array['x', 'sq', '%', '/', '-']
      else array['x', 'sq', '%', '/', '+'] end) o order by random()
  loop
    if v_op = '+' then
      a := public._rand(add_lo[l], add_hi[l]); b := public._rand(add_lo[l], add_hi[l]); v_ans := a + b;
    elsif v_op = '-' then
      a := public._rand(add_lo[l] * 2, add_hi[l] * 2); b := public._rand(add_lo[l], a - add_lo[l] / 2 - 1); v_ans := a - b;
    elsif v_op = 'x' then
      a := public._rand(mul_a_lo[l], mul_a_hi[l]); b := public._rand(mul_b_lo[l], mul_b_hi[l]); v_ans := a * b;
    elsif v_op = '/' then
      b := public._rand(div_lo[l], div_hi[l]); v_ans := public._rand(quo_lo[l], quo_hi[l]); a := b * v_ans;
    elsif v_op = '%' then
      b := pct[public._rand(1, cardinality(pct))]; a := pct_step[l] * public._rand(pct_lo[l], pct_hi[l]); v_ans := a * b / 100;
    else
      a := public._rand(sq_lo[l], sq_hi[l]); b := 2; v_ans := a * a;
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('a', a, 'op', v_op, 'b', b, 'answer', v_ans));
  end loop;
  return v_out;
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
    v_data := jsonb_build_object('level', public._math_level_for(v_user));
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
  if ch.proof_type = 'session' and (p_minutes is null or not public._valid_minutes(p_minutes)) then
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
    v_data := jsonb_build_object('level', public._math_level_for(v_user));
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
  v_ms int;
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
    raise exception 'Réponds à toutes les questions.';
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
  v_ms := greatest(0, round(extract(epoch from now() - s.started_at) * 1000))::int;

  update public.proof_sessions set status = 'completed', ended_at = now() where id = s.id;
  insert into public.mental_math (user_id, enrollment_id, session_id, day, level, questions, correct, total, points, duration_ms)
  values (s.user_id, s.enrollment_id, s.id, s.day, coalesce((s.data ->> 'level')::int, 2), v_checked, v_correct,
    jsonb_array_length(v_questions), v_points, v_ms)
  returning id into v_mm;
  perform public._award(s.enrollment_id, s.user_id, s.day, v_points, 'mental_math', v_mm);
  -- V15 : le niveau suit les résultats, un cran par jour au plus. 4 ou 5 bonnes réponses : il monte ; 2 ou moins : il
  -- redescend. Le premier calcul du jour seulement (une quête de réveil le même jour ne compte pas deux fois).
  if not exists (select 1 from public.mental_math where user_id = s.user_id and day = s.day and id <> v_mm) then
    update public.profiles
       set math_level = least(10, greatest(1, coalesce((s.data ->> 'level')::int, public._math_level_for(s.user_id))
         + case when v_correct >= 4 then 1 when v_correct <= 2 then -1 else 0 end))
     where id = s.user_id;
  end if;

  if s.principle_id is not null then
    v_result := public._create_validation(s.user_id, s.principle_id, s.day, 'reveil', 'forte', s.id, null, null);
  else
    perform public._evaluate_assignment(s.challenge_assignment_id, false);
    perform public._after_change(s.user_id);
  end if;
  return jsonb_build_object('status', 'completed', 'validation', v_result, 'correct', v_correct,
    'total', jsonb_array_length(v_questions), 'bonus', v_points, 'questions', v_checked, 'duration_ms', v_ms,
    'level', coalesce((s.data ->> 'level')::int, 1), 'next_level', public._math_level_for(s.user_id));
end;
$$;

create or replace function public.my_mental_math() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'level', public._math_level_for((select auth.uid())),
    'mode', (select pr.math_mode from public.profiles pr where pr.id = (select auth.uid())),
    'start', public._math_base((select auth.uid())),
    'quizzes', count(*)::int,
    'correct', coalesce(sum(mm.correct), 0)::int,
    'total', coalesce(sum(mm.total), 0)::int,
    'points', coalesce(sum(mm.points), 0)::int,
    'avg_ms', round(avg(mm.duration_ms))::int,
    'best_ms', min(mm.duration_ms) filter (where mm.correct = mm.total),
    'entries', coalesce(jsonb_agg(jsonb_build_object('id', mm.id, 'day', mm.day, 'level', mm.level,
      'questions', mm.questions, 'correct', mm.correct, 'total', mm.total, 'points', mm.points,
      'duration_ms', mm.duration_ms)
      order by mm.day desc, mm.created_at desc), '[]'::jsonb)
  )
  from public.mental_math mm
  where mm.user_id = (select auth.uid()) and mm.day >= public.paris_today() - 59;
$$;

revoke execute on function public._math_base(uuid), public._math_level_for(uuid) from public, anon, authenticated;
revoke execute on function public.set_math_mode(text) from public, anon;
grant execute on function public.set_math_mode(text) to authenticated;

commit;
