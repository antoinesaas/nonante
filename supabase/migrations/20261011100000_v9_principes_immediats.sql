-- V9 (11 octobre 2026) : pendant l'arc, un principe ajouté, modifié ou retiré compte tout de suite.
-- Avant, tout changement attendait le lendemain : le joueur ne voyait rien bouger sur « Aujourd'hui » et
-- croyait que l'enregistrement avait échoué. Seule exception, pour que la journée reste honnête : un principe
-- déjà prouvé aujourd'hui (ou dont une session a été lancée aujourd'hui) change à partir de demain.
-- Et le minuteur peut changer de durée avant d'être lancé (le principe est modifié en conséquence).

-- Le principe a-t-il déjà servi aujourd'hui (preuve ou session) ?
create or replace function public._used_today(p_principle uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.validations where principle_id = p_principle and day = public.paris_today())
      or exists (select 1 from public.proof_sessions where principle_id = p_principle and day = public.paris_today());
$$;

create or replace function public._save_principle(
  p_user uuid,
  p_id uuid,
  p_pillar text,
  p_if text,
  p_then text,
  p_proof_type text,
  p_target jsonb,
  p_days int[],
  p_difficulty int,
  p_template_code text,
  p_why text
) returns uuid
language plpgsql set search_path = '' as $$
declare
  e public.enrollments := public._open_enrollment(p_user);
  v_today date := public.paris_today();
  v_eff date;
  v_running boolean;
  v_max int;
  v_target jsonb;
  v_days int[];
  v_diff int;
  p public.principles;
  v_id uuid;
  v_pos int;
begin
  if e.id is null then
    raise exception 'Commence par créer ton arc.';
  end if;
  v_eff := public._effective_day(e);
  if v_eff > e.end_date then
    raise exception 'Ton arc se termine : les principes ne changent plus.';
  end if;
  v_running := e.status = 'active' and v_today >= e.start_date;
  if p_pillar is null or p_pillar not in ('focus', 'corps', 'business', 'esprit', 'energie') then
    raise exception 'Choisis un pilier.';
  end if;
  if p_proof_type is null or p_proof_type not in ('session', 'reps', 'reveil', 'photo', 'capture', 'lien', 'declaratif') then
    raise exception 'Choisis une preuve.';
  end if;
  v_days := array(select distinct d from unnest(coalesce(p_days, '{}')) d where d between 1 and 7 order by d);
  if cardinality(v_days) = 0 then
    raise exception 'Choisis au moins un jour.';
  end if;
  v_target := public._clean_target(p_proof_type, p_target);
  v_diff := public._difficulty(p_proof_type, v_target, p_difficulty);

  if p_id is null then
    v_max := (public._limits(public._plan(p_user)) ->> 'max_principles')::int;
    if public._principles_count_at(e.id, v_eff) >= v_max then
      raise exception 'Ton plan permet % principes. Passe Pro pour en avoir 12.', v_max;
    end if;
    select coalesce(max(position), 0) + 1 into v_pos from public.principles where enrollment_id = e.id;
    -- Pendant l'arc : en vigueur dès aujourd'hui.
    insert into public.principles (enrollment_id, position, pillar, if_text, then_text, proof_type, difficulty, days,
      target, source, template_code, why, active_from)
    values (e.id, v_pos, p_pillar, public._if_text(p_if, e.locale), public._then_text(p_then, e.locale), p_proof_type, v_diff, v_days,
      v_target, case when p_template_code is null then 'custom' else 'template' end, p_template_code, p_why,
      case when v_running then v_today else v_eff end)
    returning id into v_id;
    return v_id;
  end if;

  select * into p from public.principles where id = p_id and enrollment_id = e.id;
  if p.id is null or (p.active_until is not null and p.active_until < v_eff) then
    raise exception 'Principe introuvable.';
  end if;
  if p.active_from >= v_eff or (v_running and p.active_from >= v_today and not public._used_today(p.id)) then
    -- Pas encore en vigueur, ou en vigueur depuis aujourd'hui sans avoir servi : modifié directement.
    update public.principles
    set pillar = p_pillar, if_text = public._if_text(p_if, e.locale), then_text = public._then_text(p_then, e.locale),
        proof_type = p_proof_type, difficulty = v_diff, days = v_days, target = v_target
    where id = p.id;
    return p.id;
  end if;
  if v_running and not public._used_today(p.id) then
    -- Pas encore prouvé aujourd'hui : la nouvelle version remplace l'ancienne dès aujourd'hui.
    update public.principles set active_until = v_today - 1 where id = p.id;
    v_eff := v_today;
  else
    -- Déjà prouvé aujourd'hui : la journée reste comme elle était, la nouvelle version commence demain.
    update public.principles set active_until = v_eff - 1 where id = p.id;
  end if;
  insert into public.principles (enrollment_id, position, pillar, if_text, then_text, proof_type, difficulty, days,
    target, source, template_code, why, active_from)
  values (e.id, p.position, p_pillar, public._if_text(p_if, e.locale), public._then_text(p_then, e.locale), p_proof_type, v_diff, v_days,
    v_target, p.source, p.template_code, p.why, v_eff)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.remove_principle(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._open_enrollment(v_user);
  v_today date := public.paris_today();
  v_eff date;
  v_running boolean;
  p public.principles;
begin
  if e.id is null then
    raise exception 'Principe introuvable.';
  end if;
  v_eff := public._effective_day(e);
  v_running := e.status = 'active' and v_today >= e.start_date;
  select * into p from public.principles where id = p_id and enrollment_id = e.id;
  if p.id is null or (p.active_until is not null and p.active_until < v_eff) then
    raise exception 'Principe introuvable.';
  end if;
  if public._principles_count_at(e.id, v_eff) <= 1 then
    raise exception 'Garde au moins un principe.';
  end if;
  if p.active_from >= v_eff or (v_running and p.active_from >= v_today and not public._used_today(p.id)) then
    delete from public.principles where id = p.id;
  elsif v_running and not public._used_today(p.id) then
    -- Pas encore prouvé aujourd'hui : retiré dès aujourd'hui.
    update public.principles set active_until = v_today - 1 where id = p.id;
  else
    update public.principles set active_until = v_eff - 1 where id = p.id;
  end if;
end;
$$;

-- Minuteur : changer la durée juste avant de lancer. Le principe suit (cible, difficulté, texte « 50 minutes »).
create or replace function public.set_session_minutes(p_id uuid, p_minutes int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._open_enrollment(v_user);
  p public.principles;
  v_then text;
begin
  if p_minutes is null or p_minutes not in (25, 50, 90) then
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
  if public._used_today(p.id) then
    raise exception 'Déjà validé aujourd''hui.';
  end if;
  v_then := regexp_replace(p.then_text, '\d+(\s?(minutes|minute|min|Minuten|minutos)\y)', p_minutes::text || '\1');
  return public._save_principle(v_user, p.id, p.pillar, p.if_text, v_then, p.proof_type,
    jsonb_set(p.target, '{minutes}', to_jsonb(p_minutes)), p.days, p.difficulty, null, null);
end;
$$;

revoke execute on function public._used_today(uuid) from public, anon, authenticated;
revoke execute on function public.set_session_minutes(uuid, int) from public, anon;
grant execute on function public.set_session_minutes(uuid, int) to authenticated;
