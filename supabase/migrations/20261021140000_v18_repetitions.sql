-- V18 (21 octobre 2026) : l'écran de la caméra propose de changer le nombre de répétitions et l'exercice (pompes ou
-- squats) juste avant de commencer, comme la durée du minuteur. Le principe suit (cible, texte, difficulté).

-- Texte « alors 20 pompes » → « alors 30 squats », dans la langue de l'arc.
create or replace function public._reps_text(p_then text, p_exercise text, p_reps int, p_locale text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(
    regexp_replace(p_then, '\d+', p_reps::text),
    '(pompes|squats|push-ups|pushups|Liegestütze|Kniebeugen|flexiones|sentadillas)',
    case coalesce(p_locale, 'fr')
      when 'en' then case when p_exercise = 'squat' then 'squats' else 'push-ups' end
      when 'de' then case when p_exercise = 'squat' then 'Kniebeugen' else 'Liegestütze' end
      when 'es' then case when p_exercise = 'squat' then 'sentadillas' else 'flexiones' end
      else case when p_exercise = 'squat' then 'squats' else 'pompes' end
    end);
$$;

create or replace function public.set_reps_target(p_id uuid, p_exercise text, p_reps int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._open_enrollment(v_user);
  p public.principles;
  v_target jsonb;
  v_then text;
begin
  if p_exercise is null or p_exercise not in ('pushup', 'squat') then
    raise exception 'Exercice : pompes ou squats.';
  end if;
  if p_reps is null or p_reps < 5 or p_reps > 300 then
    raise exception 'Nombre de répétitions : de 5 à 300.';
  end if;
  select * into p from public.principles where id = p_id and enrollment_id = e.id;
  if e.id is null or p.id is null then
    raise exception 'Principe introuvable.';
  end if;
  if p.proof_type <> 'reps' then
    raise exception 'Ce principe demande une autre preuve.';
  end if;
  if p.target ->> 'exercise' = p_exercise and (p.target ->> 'reps')::int = p_reps then
    return p.id;
  end if;
  if exists (select 1 from public.validations where principle_id = p.id and day = public.paris_today()) then
    raise exception 'Déjà validé aujourd''hui.';
  end if;
  v_target := p.target || jsonb_build_object('exercise', p_exercise, 'reps', p_reps);
  v_then := public._reps_text(p.then_text, p_exercise, p_reps, e.locale);
  -- Essai déjà lancé aujourd'hui (refusé, abandonné) : changement sur place, pour réessayer tout de suite.
  if public._used_today(p.id) then
    update public.principles
       set target = v_target, then_text = v_then, difficulty = public._difficulty('reps', v_target, p.difficulty)
     where id = p.id;
    return p.id;
  end if;
  return public._save_principle(v_user, p.id, p.pillar, p.if_text, v_then, p.proof_type, v_target, p.days, p.difficulty, null, null);
end;
$$;

revoke execute on function public._reps_text(text, text, int, text) from public, anon, authenticated;
revoke execute on function public.set_reps_target(uuid, text, int) from public, anon;
grant execute on function public.set_reps_target(uuid, text, int) to authenticated;
