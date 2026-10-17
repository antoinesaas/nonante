-- V11 (17 octobre 2026) : calcul du matin à 5 questions, temps de réponse mesuré par le serveur, et la semaine en
-- anneaux (principes prouvés / prévus, jour par jour).

-- 1. Cinq questions, une de chaque sorte, réponses entières. op : + - x / % (b % de a) sq (a au carré).
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
    select o from unnest(case p_level
      when 1 then array['+', '-', 'x', '/', '%']
      when 2 then array['x', '/', '%', '+', 'sq']
      else array['x', 'sq', '%', '/', '-'] end) o order by random()
  loop
    if p_level = 1 then
      if v_op = '+' then a := public._rand(12, 89); b := public._rand(12, 89); v_ans := a + b;
      elsif v_op = '-' then a := public._rand(40, 99); b := public._rand(11, a - 11); v_ans := a - b;
      elsif v_op = 'x' then a := public._rand(3, 10); b := public._rand(3, 10); v_ans := a * b;
      elsif v_op = '/' then b := public._rand(2, 9); v_ans := public._rand(2, 12); a := b * v_ans;
      else b := (array[10, 50])[public._rand(1, 2)]; a := 20 * public._rand(1, 10); v_ans := a * b / 100;
      end if;
    elsif p_level = 2 then
      if v_op = 'x' then a := public._rand(12, 49); b := public._rand(3, 9); v_ans := a * b;
      elsif v_op = '/' then b := public._rand(3, 12); v_ans := public._rand(6, 25); a := b * v_ans;
      elsif v_op = '%' then b := (array[10, 20, 25, 50, 75])[public._rand(1, 5)]; a := 20 * public._rand(2, 20); v_ans := a * b / 100;
      elsif v_op = '+' then a := public._rand(120, 499); b := public._rand(120, 499); v_ans := a + b;
      else a := public._rand(11, 15); b := 2; v_ans := a * a;
      end if;
    else
      if v_op = 'x' then a := public._rand(13, 39); b := public._rand(13, 39); v_ans := a * b;
      elsif v_op = 'sq' then a := public._rand(11, 25); b := 2; v_ans := a * a;
      elsif v_op = '%' then b := (array[5, 15, 30, 35, 45])[public._rand(1, 5)]; a := 20 * public._rand(3, 40); v_ans := a * b / 100;
      elsif v_op = '/' then b := public._rand(12, 19); v_ans := public._rand(12, 29); a := b * v_ans;
      else a := public._rand(300, 999); b := public._rand(101, 299); v_ans := a - b;
      end if;
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object('a', a, 'op', v_op, 'b', b, 'answer', v_ans));
  end loop;
  return v_out;
end;
$$;

-- 2. Jusqu'à 5 bonnes réponses, et le temps mis (du lancement des questions à la réponse, horloge du serveur).
alter table public.mental_math drop constraint if exists mental_math_correct_check;
alter table public.mental_math add constraint mental_math_correct_check check (correct between 0 and 5);
alter table public.mental_math add column if not exists duration_ms int check (duration_ms >= 0);

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

  if s.principle_id is not null then
    v_result := public._create_validation(s.user_id, s.principle_id, s.day, 'reveil', 'forte', s.id, null, null);
  else
    perform public._evaluate_assignment(s.challenge_assignment_id, false);
    perform public._after_change(s.user_id);
  end if;
  return jsonb_build_object('status', 'completed', 'validation', v_result, 'correct', v_correct,
    'total', jsonb_array_length(v_questions), 'bonus', v_points, 'questions', v_checked, 'duration_ms', v_ms);
end;
$$;

-- Suivi du calcul mental : les 60 derniers jours, avec le temps moyen et le meilleur temps.
create or replace function public.my_mental_math() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'level', public._math_level((select en.school from public.enrollments en where en.user_id = (select auth.uid())
      and en.status <> 'draft' order by en.arc_number desc limit 1)),
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

-- 3. La semaine en anneaux : pour chacun des 7 derniers jours, principes prévus, principes prouvés, état du jour.
create or replace function public.my_week() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._current_enrollment(v_user);
  v_today date := public.paris_today();
begin
  if e.id is null then
    return '[]'::jsonb;
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', d::date,
      'in_arc', d::date between e.start_date and e.end_date,
      'status', (select ds.status from public.day_status ds where ds.enrollment_id = e.id and ds.day = d::date),
      'joker', exists (select 1 from public.joker_days j where j.enrollment_id = e.id and j.day = d::date),
      'due', (select count(*) from public.principles p
        where p.enrollment_id = e.id and d::date between e.start_date and e.end_date
          and public._on_day(p.active_from, p.active_until, p.days, d::date))::int,
      'done', (select count(*) from public.validations v
        where v.enrollment_id = e.id and v.day = d::date and v.status in ('valid', 'audit_pending'))::int
    ) order by d), '[]'::jsonb)
    from generate_series((v_today - 6)::timestamp, v_today::timestamp, interval '1 day') d
  );
end;
$$;

revoke execute on function public.my_week() from public, anon;
grant execute on function public.my_week() to authenticated;
