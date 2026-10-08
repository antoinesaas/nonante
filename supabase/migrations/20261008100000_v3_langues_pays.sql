-- V3 · Langues (fr, en, de, es), pays, classement du mois et par pays.
-- Les principes sont générés dans la langue du joueur ; les textes de l'interface vivent dans l'app.

alter table public.profiles add column if not exists locale text not null default 'fr'
  check (locale in ('fr', 'en', 'de', 'es'));
alter table public.profiles add column if not exists country text check (country ~ '^[A-Z]{2}$');
grant select (locale, country) on public.profiles to authenticated;
alter table public.enrollments add column if not exists locale text not null default 'fr'
  check (locale in ('fr', 'en', 'de', 'es'));
alter table public.principle_templates add column if not exists i18n jsonb not null default '{}';

-- Langue valide, sinon français.
create or replace function public._locale(p text) returns text
language sql immutable set search_path = '' as $$
  select case when p in ('fr', 'en', 'de', 'es') then p else 'fr' end;
$$;

-- Heure dans la langue : « 6 h 30 » (fr), « 6:30 » (en, es), « 6:30 Uhr » (de).
create or replace function public._time_local(p_time time, p_locale text) returns text
language sql immutable set search_path = '' as $$
  select case public._locale(p_locale)
    when 'fr' then public._time_fr(p_time)
    when 'de' then extract(hour from p_time)::int || ':' || lpad(extract(minute from p_time)::int::text, 2, '0') || ' Uhr'
    else extract(hour from p_time)::int || ':' || lpad(extract(minute from p_time)::int::text, 2, '0')
  end;
$$;

-- « si… » dans la langue : « If … », « Wenn … », « Si … ».
create or replace function public._if_text(p_text text, p_locale text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := rtrim(regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g'), ',');
  l text := public._locale(p_locale);
begin
  if l = 'fr' then
    return public._if_text(p_text);
  end if;
  if (l = 'en' and v ~* '^(if|when) ') or (l = 'de' and v ~* '^(wenn|falls|sobald) ') or (l = 'es' and v ~* '^(si|cuando) ') then
    v := upper(left(v, 1)) || substr(v, 2);
  else
    v := case l when 'en' then 'If ' when 'de' then 'Wenn ' else 'Si ' end || v;
  end if;
  if length(v) < 4 or length(v) > 120 then
    raise exception 'Le « si » : de 2 à 110 caractères.';
  end if;
  return v;
end;
$$;

-- « alors… » dans la langue : « then … », « dann … », « entonces … ».
create or replace function public._then_text(p_text text, p_locale text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g');
  l text := public._locale(p_locale);
begin
  if l = 'fr' then
    return public._then_text(p_text);
  end if;
  v := rtrim(regexp_replace(v, '^(then|dann|entonces)\s+', '', 'i'), '.');
  if length(v) < 2 or length(v) > 150 then
    raise exception 'Le « alors » : de 2 à 150 caractères.';
  end if;
  return case l when 'en' then 'then ' when 'de' then 'dann ' else 'entonces ' end || v || '.';
end;
$$;


-- Gabarit rendu dans la langue de l'arc.
drop function if exists public._render_template(text, time, int, text);
create function public._render_template(p_code text, p_wake time, p_focus int, p_pushups text, p_locale text default 'fr') returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  t public.principle_templates;
  v_target jsonb;
  v_if text;
  v_then text;
  v_reps int;
  l text := public._locale(p_locale);
  tr jsonb;
  v_why text;
  v_source text;
begin
  select * into t from public.principle_templates where code = p_code;
  if t.code is null then
    return null;
  end if;
  tr := case when l <> 'fr' then t.i18n -> l end;
  v_target := t.target;
  v_if := coalesce(tr ->> 'if_text', t.if_text);
  v_then := coalesce(tr ->> 'then_text', t.then_text);
  v_why := coalesce(tr ->> 'why', t.why);
  v_source := coalesce(tr ->> 'source', t.source);
  if tr ? 'unit' and v_target ? 'unit' then
    v_target := jsonb_set(v_target, '{unit}', to_jsonb(tr ->> 'unit'));
  end if;
  if t.proof_type = 'reveil' then
    v_target := jsonb_build_object('before', to_char(p_wake, 'HH24:MI'));
    v_if := case l
      when 'en' then 'If it''s ' || public._time_local(p_wake, l)
      when 'de' then 'Wenn es ' || public._time_local(p_wake, l) || ' ist'
      when 'es' then 'Si son las ' || public._time_local(p_wake, l)
      else 'S''il est ' || public._time_fr(p_wake)
    end;
  elsif t.code = 'bloc_profond' then
    v_target := jsonb_build_object('minutes', p_focus);
    v_then := replace(v_then, '{minutes}', p_focus::text);
  elsif t.proof_type = 'reps' then
    v_reps := case
      when t.target ->> 'exercise' = 'squat' then (t.target ->> 'reps')::int
      when p_pushups = 'quelques' then 10
      else (t.target ->> 'reps')::int
    end;
    v_target := jsonb_build_object('exercise', t.target ->> 'exercise', 'reps', v_reps);
    v_then := replace(v_then, '{reps}', v_reps::text);
  end if;
  return jsonb_build_object('code', t.code, 'pillar', t.pillar, 'if_text', v_if, 'then_text', v_then,
    'proof_type', t.proof_type, 'target', v_target, 'days', to_jsonb(t.days), 'difficulty', t.difficulty,
    'why', v_why, 'source', v_source);
end;
$$;


create or replace function public._add_template(p_user uuid, p_code text) returns uuid
language plpgsql set search_path = '' as $$
declare
  e public.enrollments := public._open_enrollment(p_user);
  r jsonb;
begin
  if e.id is null then
    raise exception 'Gabarit introuvable.';
  end if;
  r := public._render_template(p_code, e.wake_time, e.focus_minutes, e.pushups, e.locale);
  if r is null then
    raise exception 'Gabarit introuvable.';
  end if;
  return public._save_principle(p_user, null, r ->> 'pillar', r ->> 'if_text', r ->> 'then_text', r ->> 'proof_type',
    r -> 'target', array(select jsonb_array_elements_text(r -> 'days')::int), (r ->> 'difficulty')::int, p_code, r ->> 'why');
end;
$$;


-- Textes « si… alors… » normalisés dans la langue de l'arc.
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
  v_eff date;
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
    insert into public.principles (enrollment_id, position, pillar, if_text, then_text, proof_type, difficulty, days,
      target, source, template_code, why, active_from)
    values (e.id, v_pos, p_pillar, public._if_text(p_if, e.locale), public._then_text(p_then, e.locale), p_proof_type, v_diff, v_days,
      v_target, case when p_template_code is null then 'custom' else 'template' end, p_template_code, p_why, v_eff)
    returning id into v_id;
    return v_id;
  end if;

  select * into p from public.principles where id = p_id and enrollment_id = e.id;
  if p.id is null or (p.active_until is not null and p.active_until < v_eff) then
    raise exception 'Principe introuvable.';
  end if;
  if p.active_from >= v_eff then
    -- Pas encore en vigueur : modifié directement.
    update public.principles
    set pillar = p_pillar, if_text = public._if_text(p_if, e.locale), then_text = public._then_text(p_then, e.locale),
        proof_type = p_proof_type, difficulty = v_diff, days = v_days, target = v_target
    where id = p.id;
    return p.id;
  end if;
  -- En vigueur : l'ancienne version s'arrête ce soir, la nouvelle commence demain.
  update public.principles set active_until = v_eff - 1 where id = p.id;
  insert into public.principles (enrollment_id, position, pillar, if_text, then_text, proof_type, difficulty, days,
    target, source, template_code, why, active_from)
  values (e.id, p.position, p_pillar, public._if_text(p_if, e.locale), public._then_text(p_then, e.locale), p_proof_type, v_diff, v_days,
    v_target, p.source, p.template_code, p.why, v_eff)
  returning id into v_id;
  return v_id;
end;
$$;


-- Aperçu pour un visiteur, dans sa langue.
drop function if exists public.preview_principles(text, text, text[], text, text, int);
create function public.preview_principles(
  p_category text,
  p_goal_type text,
  p_weak_points text[],
  p_wake_time text,
  p_pushups text,
  p_focus_minutes int,
  p_locale text default 'fr'
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_wake time := public._hhmm(p_wake_time);
  v_weak text[] := array(select distinct w from unnest(coalesce(p_weak_points, '{}')) w limit 7);
  v_out jsonb := '[]'::jsonb;
  v_code text;
  r jsonb;
begin
  if p_category is null or p_category not in ('etudes', 'business', 'mixte')
    or p_goal_type is null or p_goal_type not in ('revenu', 'clients', 'lancement', 'audience', 'examens', 'corps', 'autre')
    or v_wake is null or v_wake < '04:00' or v_wake > '10:00'
    or p_pushups is null or p_pushups not in ('oui', 'quelques', 'non')
    or p_focus_minutes is null or p_focus_minutes not in (25, 50, 90) then
    raise exception 'Réponses incomplètes.';
  end if;
  foreach v_code in array public._pick_templates(p_category, p_goal_type, v_weak, p_pushups) loop
    r := public._render_template(v_code, v_wake, p_focus_minutes, p_pushups, p_locale);
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'code', r ->> 'code', 'pillar', r ->> 'pillar',
      'if_text', public._if_text(r ->> 'if_text', p_locale), 'then_text', public._then_text(r ->> 'then_text', p_locale),
      'proof_type', r ->> 'proof_type', 'days', r -> 'days', 'why', r ->> 'why', 'source', r ->> 'source',
      'difficulty', public._difficulty(r ->> 'proof_type', public._clean_target(r ->> 'proof_type', r -> 'target'),
        (r ->> 'difficulty')::int)));
  end loop;
  return jsonb_build_object('principles', v_out, 'templates', (select count(*) from public.principle_templates));
end;
$$;


-- L'arc garde la langue dans laquelle il a été construit.
drop function if exists public.save_arc(text, text, text, numeric, text, boolean, text[], text, text, int, date, uuid);
create function public.save_arc(
  p_category text,
  p_goal_type text,
  p_goal_title text,
  p_goal_target numeric,
  p_goal_unit text,
  p_goal_public boolean,
  p_weak_points text[],
  p_wake_time text,
  p_pushups text,
  p_focus_minutes int,
  p_start_date date,
  p_squad_id uuid default null,
  p_locale text default 'fr'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_today date := public.paris_today();
  v_goal text := regexp_replace(btrim(coalesce(p_goal_title, '')), '\s+', ' ', 'g');
  v_unit text := nullif(btrim(coalesce(p_goal_unit, '')), '');
  v_weak text[] := array(select distinct w from unnest(coalesce(p_weak_points, '{}')) w);
  v_wake time := public._hhmm(p_wake_time);
  v_start date := p_start_date;
  s public.squads;
  e public.enrollments;
  v_number int;
begin
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Crée d''abord ton profil.';
  end if;
  if p_category is null or p_category not in ('etudes', 'business', 'mixte') then
    raise exception 'Choisis ton profil.';
  end if;
  if p_goal_type is null or p_goal_type not in ('revenu', 'clients', 'lancement', 'audience', 'examens', 'corps', 'autre') then
    raise exception 'Choisis le type de ton objectif.';
  end if;
  if length(v_goal) < 3 or length(v_goal) > 120 then
    raise exception 'Ton objectif tient en une phrase, de 3 à 120 caractères.';
  end if;
  if p_goal_target is not null and (p_goal_target <= 0 or p_goal_target >= 1000000000) then
    raise exception 'Chiffre de l''objectif invalide.';
  end if;
  if length(coalesce(v_unit, '')) > 20 then
    raise exception 'Unité trop longue.';
  end if;
  if exists (select 1 from unnest(v_weak) w
    where w not in ('telephone', 'procrastination', 'reveil', 'sport', 'dispersion', 'vente', 'regularite')) then
    raise exception 'Point faible invalide.';
  end if;
  if v_wake is null or v_wake < '04:00' or v_wake > '10:00' then
    raise exception 'Choisis une heure de lever entre 4 h et 10 h.';
  end if;
  if p_pushups is null or p_pushups not in ('oui', 'quelques', 'non') then
    raise exception 'Réponds à la question sur les pompes.';
  end if;
  if p_focus_minutes is null or p_focus_minutes not in (25, 50, 90) then
    raise exception 'Durée de concentration : 25, 50 ou 90 minutes.';
  end if;

  if p_squad_id is not null then
    select * into s from public.squads where id = p_squad_id and is_official and start_date is not null;
    if s.id is null or s.start_date < v_today then
      raise exception 'Ce départ collectif n''est plus ouvert.';
    end if;
    v_start := s.start_date;
  end if;
  if v_start is null or v_start < v_today or v_start > v_today + 120 then
    raise exception 'Choisis un jour 1 entre aujourd''hui et les 4 prochains mois.';
  end if;

  e := public._open_enrollment(v_user);
  if e.id is not null and not (e.status = 'draft' or v_today < e.start_date) then
    raise exception 'Ton arc est en cours : tes principes se modifient dans l''onglet Principes.';
  end if;

  if e.id is null then
    select coalesce(max(arc_number), 0) + 1 into v_number from public.enrollments where user_id = v_user;
    insert into public.enrollments (user_id, arc_number, start_date, category, goal_type, goal_title, goal_target,
      goal_unit, goal_public, weak_points, wake_time, pushups, focus_minutes, utm_source, utm_campaign, locale)
    select v_user, v_number, v_start, p_category, p_goal_type, v_goal, p_goal_target, v_unit, coalesce(p_goal_public, false),
      v_weak, v_wake, p_pushups, p_focus_minutes, pr.utm_source, pr.utm_campaign, public._locale(p_locale)
    from public.profiles pr where pr.id = v_user
    returning * into e;
    perform public._generate_principles(e.id);
    -- Arc 90 jours payé d'avance : rattaché à ce nouvel arc.
    update public.profiles set arc_credits = arc_credits - 1 where id = v_user and arc_credits > 0;
    if found then
      update public.enrollments set arc_paid = true, arc_payment = 'credit' where id = e.id;
    end if;
  else
    update public.enrollments
    set category = p_category, goal_type = p_goal_type, goal_title = v_goal, goal_target = p_goal_target,
        goal_unit = v_unit, goal_public = coalesce(p_goal_public, false), weak_points = v_weak, wake_time = v_wake,
        pushups = p_pushups, focus_minutes = p_focus_minutes, start_date = v_start, locale = public._locale(p_locale)
    where id = e.id;
    update public.principles set active_from = v_start where enrollment_id = e.id;
  end if;

  if s.id is not null then
    insert into public.squad_members (squad_id, user_id) values (s.id, v_user) on conflict do nothing;
  end if;
  perform public._activate_enrollment(e.id);
  return e.id;
end;
$$;


-- Profil : langue et pays (deviné à l'inscription, modifiable).
drop function if exists public.save_profile(text, int, boolean, boolean, text, text);
create function public.save_profile(
  p_pseudo text,
  p_birth_year int,
  p_adult boolean,
  p_is_public boolean,
  p_utm_source text default null,
  p_utm_campaign text default null,
  p_locale text default 'fr',
  p_country text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_today date := public.paris_today();
  v_pseudo text := lower(btrim(coalesce(p_pseudo, '')));
begin
  if exists (select 1 from public.profiles where id = v_user) then
    update public.profiles set is_public = coalesce(p_is_public, is_public) where id = v_user;
    return;
  end if;
  if v_pseudo !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Pseudo : 3 à 20 caractères, en minuscules, chiffres ou _.';
  end if;
  if p_birth_year is null or p_birth_year < 1900 or p_birth_year > extract(year from v_today)::int
    or extract(year from v_today)::int - p_birth_year < 18 or not coalesce(p_adult, false) then
    raise exception 'Nonante est réservé aux personnes majeures.';
  end if;
  if exists (select 1 from public.profiles where pseudo = v_pseudo) then
    raise exception 'Ce pseudo est déjà pris.';
  end if;
  insert into public.profiles (id, pseudo, birth_year, is_public, referral_code, utm_source, utm_campaign, locale, country)
  values (v_user, v_pseudo, p_birth_year, coalesce(p_is_public, false), upper(replace(v_pseudo, '_', '-')),
    left(p_utm_source, 100), left(p_utm_campaign, 100), public._locale(p_locale),
    case when upper(p_country) ~ '^[A-Z]{2}$' then upper(p_country) end);
  insert into public.player_stats (user_id) values (v_user) on conflict do nothing;
end;
$$;


-- Langue et pays choisis par le joueur (réglages).
create or replace function public.set_my_locale(p_locale text) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set locale = public._locale(p_locale) where id = auth.uid();
$$;

create or replace function public.set_my_country(p_country text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_country is not null and upper(p_country) !~ '^[A-Z]{2}$' then
    raise exception 'Pays invalide.';
  end if;
  update public.profiles set country = upper(p_country) where id = public._require_user();
end;
$$;


-- Bibliothèque de principes dans la langue de l'arc.
create or replace function public.my_principles() returns jsonb
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
        'code', t.code, 'pillar', t.pillar,
        'if_text', coalesce(t.i18n -> e.locale ->> 'if_text', t.if_text),
        'then_text', coalesce(t.i18n -> e.locale ->> 'then_text', t.then_text), 'proof_type', t.proof_type,
        'difficulty', t.difficulty, 'days', t.days, 'target', t.target,
        'why', coalesce(t.i18n -> e.locale ->> 'why', t.why), 'source', coalesce(t.i18n -> e.locale ->> 'source', t.source),
        'recommended', e.goal_type = any(t.goal_types)
          or exists (select 1 from unnest(t.weak_points) w where w = any(e.weak_points))
      ) order by t.pillar, t.sort), '[]'::jsonb)
      from public.principle_templates t
    )
  );
end;
$$;


-- La quête porte son code (titre traduit dans l'app).
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


create or replace function public.my_profile() returns jsonb
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
    'referral_rewards', prof.referral_rewards,
    'locale', prof.locale,
    'country', prof.country,
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


-- Classement : semaine (depuis lundi), mois (depuis le 1er), général ; le pays de chaque joueur pour filtrer.
drop function if exists public.leaderboard(text, text, uuid);
create function public.leaderboard(p_period text default 'semaine', p_category text default null, p_squad uuid default null)
returns table (rank int, pseudo text, avatar_path text, level int, ovr int, category text, country text, points int,
  streak int, is_me boolean, is_public boolean)
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
      and ((select day from since) is null or l.day >= (select day from since))), 0)::int as points
    from players pl
    where p_category is null or pl.category = p_category
  )
  select (rank() over (order by s.points desc, s.streak desc, s.ovr desc))::int,
    case when s.is_public then s.pseudo else 'Anonyme' end,
    case when s.is_public then s.avatar_path end,
    s.level, s.ovr, s.category, s.country, s.points, s.streak,
    coalesce(s.id = auth.uid(), false),
    s.is_public
  from scored s
  order by 1, s.streak desc
  limit 500;
$$;

-- Droits d'exécution des fonctions nouvelles ou recréées (rien par défaut, puis le strict nécessaire).
revoke execute on function public._locale(text), public._time_local(time, text), public._if_text(text, text),
  public._then_text(text, text), public._render_template(text, time, int, text, text)
  from public, anon, authenticated;
revoke execute on function public.save_profile(text, int, boolean, boolean, text, text, text, text),
  public.save_arc(text, text, text, numeric, text, boolean, text[], text, text, int, date, uuid, text),
  public.set_my_locale(text), public.set_my_country(text)
  from public, anon;
grant execute on function public.save_profile(text, int, boolean, boolean, text, text, text, text) to authenticated;
grant execute on function public.save_arc(text, text, text, numeric, text, boolean, text[], text, text, int, date, uuid, text) to authenticated;
grant execute on function public.set_my_locale(text) to authenticated;
grant execute on function public.set_my_country(text) to authenticated;
revoke execute on function public.leaderboard(text, text, uuid),
  public.preview_principles(text, text, text[], text, text, int, text) from public;
grant execute on function public.leaderboard(text, text, uuid) to anon, authenticated, service_role;
grant execute on function public.preview_principles(text, text, text[], text, text, int, text) to anon, authenticated, service_role;


-- Traductions des gabarits (en, de, es).
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s 7:00", "then_text": "I get up and open Nonante", "why": "Getting up at a fixed time, even on weekends, sets your internal clock: more energy, less willpower wasted.", "source": "Chronobiology, sleep regularity"}, "de": {"if_text": "Wenn es 7:00 Uhr ist", "then_text": "stehe ich auf und öffne Nonante", "why": "Jeden Tag zur gleichen Zeit aufstehen, auch am Wochenende, stellt die innere Uhr: mehr Energie, weniger verschwendete Willenskraft.", "source": "Chronobiologie, Schlafregelmäßigkeit"}, "es": {"if_text": "Si son las 7:00", "then_text": "me levanto y abro Nonante", "why": "Levantarte a una hora fija, incluso el fin de semana, ajusta tu reloj interno: más energía y menos fuerza de voluntad desperdiciada.", "source": "Cronobiología, regularidad del sueño"}}'::jsonb where code = 'reveil_fixe';
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s 22:30", "then_text": "my phone sleeps outside my bedroom", "why": "A phone in bed steals hours of sleep and the first hour of your morning.", "source": "Sleep hygiene"}, "de": {"if_text": "Wenn es 22:30 Uhr ist", "then_text": "schläft mein Handy außerhalb meines Zimmers", "why": "Das Handy im Bett raubt Stunden Schlaf und die erste Stunde des Morgens.", "source": "Schlafhygiene"}, "es": {"if_text": "Si son las 22:30", "then_text": "mi móvil duerme fuera de mi habitación", "why": "El móvil en la cama te roba horas de sueño y la primera hora de la mañana.", "source": "Higiene del sueño"}}'::jsonb where code = 'telephone_dehors';
update public.principle_templates set i18n = '{"en": {"if_text": "If I get up", "then_text": "10 minutes outside in daylight, before any screen", "why": "Morning light sets your internal clock and wakes you up better than coffee.", "source": "Chronobiology"}, "de": {"if_text": "Wenn ich aufstehe", "then_text": "10 Minuten draußen im Tageslicht, vor jedem Bildschirm", "why": "Morgenlicht stellt die innere Uhr und macht wacher als Kaffee.", "source": "Chronobiologie"}, "es": {"if_text": "Si me levanto", "then_text": "10 minutos fuera, a la luz del día, antes de cualquier pantalla", "why": "La luz de la mañana ajusta tu reloj interno y despierta mejor que el café.", "source": "Cronobiología"}}'::jsonb where code = 'lumiere_matin';
update public.principle_templates set i18n = '{"en": {"if_text": "If I get out of bed", "then_text": "a big glass of water before coffee", "why": "Attaching a new habit to something you already do automatically makes it almost free.", "source": "Habit stacking (BJ Fogg, James Clear)"}, "de": {"if_text": "Wenn ich aus dem Bett steige", "then_text": "ein großes Glas Wasser vor dem Kaffee", "why": "Eine neue Gewohnheit an eine schon automatische Handlung zu koppeln, macht sie fast mühelos.", "source": "Habit Stacking (BJ Fogg, James Clear)"}, "es": {"if_text": "Si salgo de la cama", "then_text": "un vaso grande de agua antes del café", "why": "Enganchar un hábito nuevo a un gesto que ya es automático lo hace casi gratis.", "source": "Apilamiento de hábitos (BJ Fogg, James Clear)"}}'::jsonb where code = 'eau_reveil';
update public.principle_templates set i18n = '{"en": {"if_text": "If I''m thirsty", "then_text": "water, never soda or energy drinks", "why": "Liquid sugar gives you a spike of energy, then a crash: you work worse two hours later.", "source": "Nutrition"}, "de": {"if_text": "Wenn ich Durst habe", "then_text": "trinke ich Wasser, nie Limo oder Energydrinks", "why": "Flüssiger Zucker gibt einen Energieschub und dann einen Absturz: Zwei Stunden später arbeitest du schlechter.", "source": "Ernährung"}, "es": {"if_text": "Si tengo sed", "then_text": "agua, nunca refrescos ni bebidas energéticas", "why": "El azúcar líquido da un pico de energía y luego un bajón: dos horas después trabajas peor.", "source": "Nutrición"}}'::jsonb where code = 'zero_soda';
update public.principle_templates set i18n = '{"en": {"if_text": "If I sit down at my desk", "then_text": "{minutes} minutes of deep work, phone in another room", "why": "One demanding task, no interruptions: that''s where the work that matters gets done.", "source": "Cal Newport, Deep Work"}, "de": {"if_text": "Wenn ich mich an meinen Schreibtisch setze", "then_text": "{minutes} Minuten konzentrierte Arbeit, Handy in einem anderen Raum", "why": "Eine anspruchsvolle Aufgabe, ohne Unterbrechung: Dort entsteht die Arbeit, die zählt.", "source": "Cal Newport, Deep Work"}, "es": {"if_text": "Si me siento en mi escritorio", "then_text": "{minutes} minutos de trabajo profundo, con el móvil en otra habitación", "why": "Una sola tarea exigente, sin interrupciones: ahí se hace el trabajo que importa.", "source": "Cal Newport, Deep Work"}}'::jsonb where code = 'bloc_profond';
update public.principle_templates set i18n = '{"en": {"if_text": "If my day starts", "then_text": "my hardest task first, done before noon", "why": "Starting with the hardest thing removes the weight that ruins the rest of the day.", "source": "Brian Tracy, Eat That Frog!"}, "de": {"if_text": "Wenn mein Tag beginnt", "then_text": "zuerst meine schwierigste Aufgabe, erledigt vor 12 Uhr", "why": "Mit dem Schwersten anzufangen, nimmt die Last, die sonst den ganzen Tag verdirbt.", "source": "Brian Tracy, Eat That Frog!"}, "es": {"if_text": "Si empieza mi día", "then_text": "primero mi tarea más difícil, terminada antes del mediodía", "why": "Empezar por lo más difícil te quita el peso que arruina el resto del día.", "source": "Brian Tracy, Eat That Frog!"}}'::jsonb where code = 'grenouille';
update public.principle_templates set i18n = '{"en": {"if_text": "If I''m tired", "then_text": "25 minutes instead of nothing", "why": "A small block beats zero: the streak goes on, and so does the discipline.", "source": "Francesco Cirillo, the Pomodoro Technique"}, "de": {"if_text": "Wenn ich müde bin", "then_text": "25 Minuten statt gar nichts", "why": "Ein kleiner Block ist besser als null: Die Serie geht weiter, die Disziplin auch.", "source": "Francesco Cirillo, Pomodoro-Technik"}, "es": {"if_text": "Si estoy cansado", "then_text": "25 minutos en lugar de nada", "why": "Un bloque pequeño es mejor que cero: la racha sigue, y la disciplina también.", "source": "Francesco Cirillo, técnica Pomodoro"}}'::jsonb where code = 'fatigue_25';
update public.principle_templates set i18n = '{"en": {"if_text": "If I don''t know where to start", "then_text": "I write down the smallest possible action and do it right away", "why": "Starting is the hardest part. A tiny action breaks the inertia.", "source": "The two-minute rule (David Allen, James Clear)"}, "de": {"if_text": "Wenn ich nicht weiß, wo ich anfangen soll", "then_text": "schreibe ich die kleinstmögliche Handlung auf und erledige sie sofort", "why": "Anfangen ist das Schwerste. Eine winzige Handlung bricht die Trägheit.", "source": "Zwei-Minuten-Regel (David Allen, James Clear)"}, "es": {"if_text": "Si no sé por dónde empezar", "then_text": "escribo la acción más pequeña posible y la hago enseguida", "why": "Empezar es lo más difícil. Una acción minúscula rompe la inercia.", "source": "Regla de los 2 minutos (David Allen, James Clear)"}}'::jsonb where code = 'deux_minutes';
update public.principle_templates set i18n = '{"en": {"if_text": "If my day is ending", "then_text": "I write tomorrow''s one priority, on paper", "why": "A priority decided the night before means a morning without hesitation.", "source": "Ivy Lee method, Gary Keller (The ONE Thing)"}, "de": {"if_text": "Wenn mein Tag endet", "then_text": "schreibe ich die eine Priorität für morgen auf Papier", "why": "Eine am Vorabend festgelegte Priorität bedeutet einen Morgen ohne Zögern.", "source": "Ivy-Lee-Methode, Gary Keller (The ONE Thing)"}, "es": {"if_text": "Si termina mi día", "then_text": "escribo en papel la única prioridad de mañana", "why": "Una prioridad decidida la víspera es una mañana sin dudas.", "source": "Método Ivy Lee, Gary Keller (The ONE Thing)"}}'::jsonb where code = 'une_priorite';
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s the weekend", "then_text": "my longest session, done before noon", "why": "On weekends, others switch off. That''s when you get ahead.", "source": "Cal Newport, Deep Work"}, "de": {"if_text": "Wenn Wochenende ist", "then_text": "meine längste Session, fertig vor 12 Uhr", "why": "Am Wochenende schalten die anderen ab. Genau dann ziehst du davon.", "source": "Cal Newport, Deep Work"}, "es": {"if_text": "Si es fin de semana", "then_text": "mi sesión más larga, terminada antes del mediodía", "why": "El fin de semana los demás desconectan. Ahí es cuando tomas ventaja.", "source": "Cal Newport, Deep Work"}}'::jsonb where code = 'weekend_90';
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s Sunday evening", "then_text": "I plan my week block by block", "why": "A planned week happens less to you: every block already has its place.", "source": "Weekly review (David Allen, Getting Things Done)"}, "de": {"if_text": "Wenn Sonntagabend ist", "then_text": "plane ich meine Woche Block für Block", "why": "Eine geplante Woche überrollt dich nicht: Jeder Block hat schon seinen Platz.", "source": "Wochenrückblick (David Allen, Getting Things Done)"}, "es": {"if_text": "Si es domingo por la tarde", "then_text": "planifico mi semana bloque a bloque", "why": "Una semana planificada no te arrastra: cada bloque ya tiene su sitio.", "source": "Revisión semanal (David Allen, Getting Things Done)"}}'::jsonb where code = 'revue_dimanche';
update public.principle_templates set i18n = '{"en": {"if_text": "If I wake up", "then_text": "no social media before noon", "why": "In the morning your attention is at its best. Don''t give it away.", "source": "Cal Newport, Digital Minimalism"}, "de": {"if_text": "Wenn ich aufwache", "then_text": "keine sozialen Netzwerke vor 12 Uhr", "why": "Morgens ist deine Aufmerksamkeit am besten. Verschenk sie nicht an andere.", "source": "Cal Newport, Digital Minimalism"}, "es": {"if_text": "Si me despierto", "then_text": "nada de redes sociales antes del mediodía", "why": "Por la mañana tu atención está en su mejor momento. No se la regales a otros.", "source": "Cal Newport, Digital Minimalism"}}'::jsonb where code = 'reseaux_midi';
update public.principle_templates set i18n = '{"en": {"if_text": "If I have an exam this month", "then_text": "50 minutes of exercises and past papers, no rereading", "why": "Testing yourself makes you remember better than rereading: that''s the testing effect.", "source": "Roediger and Karpicke, retrieval practice"}, "de": {"if_text": "Wenn ich diesen Monat eine Prüfung habe", "then_text": "50 Minuten Übungen und alte Prüfungen, kein bloßes Durchlesen", "why": "Sich selbst abzufragen bleibt besser hängen als Wiederlesen: der Testeffekt.", "source": "Roediger und Karpicke, Abrufübung"}, "es": {"if_text": "Si tengo un examen este mes", "then_text": "50 minutos de ejercicios y exámenes anteriores, nada de releer", "why": "Ponerte a prueba hace recordar mejor que releer: es el efecto de prueba.", "source": "Roediger y Karpicke, práctica de recuperación"}}'::jsonb where code = 'revision_active';
update public.principle_templates set i18n = '{"en": {"if_text": "If I''m given an assignment", "then_text": "I start it the same day", "why": "Starting early, even a little, removes the last-night panic.", "source": "Beating procrastination"}, "de": {"if_text": "Wenn ich eine Aufgabe bekomme", "then_text": "fange ich noch am selben Tag damit an", "why": "Früh anfangen, auch nur ein bisschen, nimmt der letzten Nacht den Stress.", "source": "Gegen Prokrastination"}, "es": {"if_text": "Si me ponen un trabajo", "then_text": "lo empiezo el mismo día", "why": "Empezar pronto, aunque sea un poco, quita la urgencia de la última noche.", "source": "Contra la procrastinación"}}'::jsonb where code = 'devoir_jour_meme';
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s a weekday", "then_text": "20 messages to potential clients", "why": "Volume first: more messages, more conversations, more sales.", "source": "Alex Hormozi, the rule of 100 ($100M Leads)", "unit": "messages"}, "de": {"if_text": "Wenn Werktag ist", "then_text": "20 Nachrichten an potenzielle Kunden", "why": "Erst die Menge: mehr Nachrichten, mehr Gespräche, mehr Verkäufe.", "source": "Alex Hormozi, die 100er-Regel ($100M Leads)", "unit": "Nachrichten"}, "es": {"if_text": "Si es día laborable", "then_text": "20 mensajes a clientes potenciales", "why": "Primero el volumen: más mensajes, más conversaciones, más ventas.", "source": "Alex Hormozi, la regla de los 100 ($100M Leads)", "unit": "mensajes"}}'::jsonb where code = 'prospection';
update public.principle_templates set i18n = '{"en": {"if_text": "If I''ve sent my messages", "then_text": "a call or meeting with a prospect", "why": "One real conversation is worth a hundred messages: that''s where you understand and sell.", "source": "Consultative selling"}, "de": {"if_text": "Wenn ich meine Nachrichten verschickt habe", "then_text": "ein Anruf oder Termin mit einem Interessenten", "why": "Ein echtes Gespräch ist hundert Nachrichten wert: Dort versteht man und verkauft.", "source": "Beratender Verkauf"}, "es": {"if_text": "Si he enviado mis mensajes", "then_text": "una llamada o reunión con un cliente potencial", "why": "Una conversación de verdad vale cien mensajes: ahí es donde entiendes y vendes.", "source": "Venta consultiva"}}'::jsonb where code = 'appel_prospect';
update public.principle_templates set i18n = '{"en": {"if_text": "If a prospect hasn''t replied in 3 days", "then_text": "I follow up", "why": "Many sales happen on the follow-up, which most people never send.", "source": "Systematic follow-up"}, "de": {"if_text": "Wenn ein Interessent seit 3 Tagen nicht geantwortet hat", "then_text": "hake ich nach", "why": "Viele Verkäufe entstehen beim Nachhaken, das die meisten nie machen.", "source": "Konsequentes Nachfassen"}, "es": {"if_text": "Si un cliente potencial no ha respondido en 3 días", "then_text": "le hago seguimiento", "why": "Muchas ventas se cierran en el seguimiento, que la mayoría nunca envía.", "source": "Seguimiento sistemático"}}'::jsonb where code = 'relance';
update public.principle_templates set i18n = '{"en": {"if_text": "If a prospect hesitates", "then_text": "I clearly ask for their decision", "why": "No ask, no sale. A clear no beats a maybe.", "source": "Closing: asking for the decision"}, "de": {"if_text": "Wenn ein Interessent zögert", "then_text": "frage ich klar nach seiner Entscheidung", "why": "Ohne Frage kein Verkauf. Ein klares Nein ist besser als ein Vielleicht.", "source": "Closing: nach der Entscheidung fragen"}, "es": {"if_text": "Si un cliente potencial duda", "then_text": "le pido claramente su decisión", "why": "Sin pedir, no hay venta. Un no claro vale más que un quizá.", "source": "Cierre: pedir la decisión"}}'::jsonb where code = 'demander_vente';
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s Monday, Wednesday or Friday", "then_text": "I publish a post about my project", "why": "Showing what you''re building attracts clients, partners and opportunities.", "source": "Building in public"}, "de": {"if_text": "Wenn Montag, Mittwoch oder Freitag ist", "then_text": "veröffentliche ich einen Beitrag über mein Projekt", "why": "Zu zeigen, was du baust, zieht Kunden, Partner und Chancen an.", "source": "Building in Public"}, "es": {"if_text": "Si es lunes, miércoles o viernes", "then_text": "publico un contenido sobre mi proyecto", "why": "Enseñar lo que construyes atrae clientes, socios y oportunidades.", "source": "Construir en público"}}'::jsonb where code = 'publier_contenu';
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s a weekday", "then_text": "one post published, even if imperfect", "why": "Consistency beats perfection: audiences reward those who keep showing up.", "source": "Content creation"}, "de": {"if_text": "Wenn Werktag ist", "then_text": "ein veröffentlichter Beitrag, auch wenn er nicht perfekt ist", "why": "Regelmäßigkeit schlägt Perfektion: Das Publikum belohnt die, die immer wiederkommen.", "source": "Content-Erstellung"}, "es": {"if_text": "Si es día laborable", "then_text": "un contenido publicado, aunque sea imperfecto", "why": "La constancia gana a la perfección: la audiencia premia a quien vuelve.", "source": "Creación de contenido"}}'::jsonb where code = 'contenu_quotidien';
update public.principle_templates set i18n = '{"en": {"if_text": "If I''m working on my product", "then_text": "90 minutes to ship one visible thing", "why": "Shipping often, even small, beats the perfect project that never comes out.", "source": "Agile methods: continuous delivery"}, "de": {"if_text": "Wenn ich an meinem Produkt arbeite", "then_text": "90 Minuten, um etwas Sichtbares zu liefern", "why": "Oft liefern, auch Kleines, schlägt das perfekte Projekt, das nie erscheint.", "source": "Agile Methoden: kontinuierlich liefern"}, "es": {"if_text": "Si trabajo en mi producto", "then_text": "90 minutos para entregar algo visible", "why": "Entregar a menudo, aunque sea poco, gana al proyecto perfecto que nunca sale.", "source": "Métodos ágiles: entregar de forma continua"}}'::jsonb where code = 'livrer';
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s 20:00", "then_text": "I write down today''s numbers: sales, prospects, followers", "why": "Looking at your numbers every day forces you to see what really works.", "source": "The founder''s dashboard"}, "de": {"if_text": "Wenn es 20 Uhr ist", "then_text": "notiere ich meine Zahlen des Tages: Verkäufe, Interessenten, Follower", "why": "Jeden Tag auf die Zahlen zu schauen zwingt dich zu sehen, was wirklich funktioniert.", "source": "Das Dashboard des Gründers"}, "es": {"if_text": "Si son las 20:00", "then_text": "apunto mis cifras del día: ventas, clientes potenciales, seguidores", "why": "Mirar tus cifras cada día te obliga a ver lo que de verdad funciona.", "source": "El panel del fundador"}}'::jsonb where code = 'chiffres_jour';
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s Friday", "then_text": "I review my week''s income in my wallet", "why": "A weekly review shows the trend before it''s too late.", "source": "Weekly review"}, "de": {"if_text": "Wenn Freitag ist", "then_text": "ziehe ich in meinem Portemonnaie Bilanz über die Einnahmen der Woche", "why": "Eine wöchentliche Bilanz zeigt den Trend, bevor es zu spät ist.", "source": "Wochenrückblick"}, "es": {"if_text": "Si es viernes", "then_text": "hago balance de mis ingresos de la semana en mi cartera", "why": "Un balance semanal muestra la tendencia antes de que sea tarde.", "source": "Revisión semanal"}}'::jsonb where code = 'revue_revenus';
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s Monday", "then_text": "I rewrite my offer in one sentence and test it on one person", "why": "A clear offer sells. A vague offer needs explaining.", "source": "Alex Hormozi, $100M Offers"}, "de": {"if_text": "Wenn Montag ist", "then_text": "formuliere ich mein Angebot in einem Satz und teste es an einer Person", "why": "Ein klares Angebot verkauft sich. Ein vages Angebot muss man erklären.", "source": "Alex Hormozi, $100M Offers"}, "es": {"if_text": "Si es lunes", "then_text": "reformulo mi oferta en una frase y la pruebo con una persona", "why": "Una oferta clara se vende. Una oferta confusa hay que explicarla.", "source": "Alex Hormozi, $100M Offers"}}'::jsonb where code = 'offre';
update public.principle_templates set i18n = '{"en": {"if_text": "If I get out of bed", "then_text": "{reps} push-ups", "why": "Moving as soon as you wake up switches your body on and starts the day with a win.", "source": "Morning exercise"}, "de": {"if_text": "Wenn ich aus dem Bett steige", "then_text": "{reps} Liegestütze", "why": "Bewegung direkt nach dem Aufwachen schaltet den Körper ein und startet den Tag mit einem Sieg.", "source": "Morgensport"}, "es": {"if_text": "Si salgo de la cama", "then_text": "{reps} flexiones", "why": "Moverte nada más despertar enciende el cuerpo y empieza el día con una victoria.", "source": "Ejercicio matinal"}}'::jsonb where code = 'pompes';
update public.principle_templates set i18n = '{"en": {"if_text": "If I get out of bed", "then_text": "{reps} squats", "why": "The biggest muscles in your body, woken up in two minutes.", "source": "Morning exercise"}, "de": {"if_text": "Wenn ich aus dem Bett steige", "then_text": "{reps} Kniebeugen", "why": "Die größten Muskeln des Körpers, in zwei Minuten geweckt.", "source": "Morgensport"}, "es": {"if_text": "Si salgo de la cama", "then_text": "{reps} sentadillas", "why": "Los músculos más grandes del cuerpo, despiertos en dos minutos.", "source": "Ejercicio matinal"}}'::jsonb where code = 'squats';
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s Monday, Wednesday or Friday", "then_text": "I go to the gym and take a photo of it", "why": "Regular exercise improves focus, mood and sleep.", "source": "Physical activity and cognition"}, "de": {"if_text": "Wenn Montag, Mittwoch oder Freitag ist", "then_text": "gehe ich ins Fitnessstudio und mache ein Foto davon", "why": "Regelmäßiger Sport verbessert Konzentration, Laune und Schlaf.", "source": "Bewegung und Kognition"}, "es": {"if_text": "Si es lunes, miércoles o viernes", "then_text": "voy al gimnasio y le hago una foto", "why": "El deporte regular mejora la concentración, el ánimo y el sueño.", "source": "Actividad física y cognición"}}'::jsonb where code = 'salle';
update public.principle_templates set i18n = '{"en": {"if_text": "If my day is ending", "then_text": "8,000 steps, screenshot of my step counter", "why": "Walking every day reduces stress and keeps your heart healthy, without wearing you out.", "source": "Studies on daily step counts", "unit": "steps"}, "de": {"if_text": "Wenn mein Tag endet", "then_text": "8.000 Schritte, Screenshot meines Schrittzählers", "why": "Tägliches Gehen senkt Stress und hält das Herz fit, ohne zu ermüden.", "source": "Studien zur täglichen Schrittzahl", "unit": "Schritte"}, "es": {"if_text": "Si termina mi día", "then_text": "8.000 pasos, captura de mi contador", "why": "Caminar cada día reduce el estrés y cuida el corazón, sin agotarte.", "source": "Estudios sobre los pasos diarios", "unit": "pasos"}}'::jsonb where code = 'marche';
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s Tuesday or Saturday", "then_text": "a 30-minute run, screenshot from the app", "why": "Endurance is discipline too: you run even when you don''t feel like it.", "source": "Endurance"}, "de": {"if_text": "Wenn Dienstag oder Samstag ist", "then_text": "30 Minuten Laufen, Screenshot aus der App", "why": "Ausdauer ist auch Disziplin: Du läufst, auch wenn du keine Lust hast.", "source": "Ausdauer"}, "es": {"if_text": "Si es martes o sábado", "then_text": "30 minutos de carrera, captura de la app", "why": "La resistencia también es disciplina: corres aunque no te apetezca.", "source": "Resistencia"}}'::jsonb where code = 'course';
update public.principle_templates set i18n = '{"en": {"if_text": "If I finish a work session", "then_text": "{reps} squats to restart my body", "why": "Sitting all day drains your energy. Two minutes of movement switch it back on.", "source": "Active breaks"}, "de": {"if_text": "Wenn ich eine Arbeitssession beende", "then_text": "{reps} Kniebeugen, um den Körper wieder in Gang zu bringen", "why": "Den ganzen Tag sitzen löscht die Energie. Zwei Minuten Bewegung schalten sie wieder an.", "source": "Aktive Pausen"}, "es": {"if_text": "Si termino una sesión de trabajo", "then_text": "{reps} sentadillas para reactivar el cuerpo", "why": "Estar sentado todo el día apaga la energía. Dos minutos de movimiento la vuelven a encender.", "source": "Pausas activas"}}'::jsonb where code = 'squats_pause';
update public.principle_templates set i18n = '{"en": {"if_text": "If I go to bed", "then_text": "10 pages of a book, no screen", "why": "Ten pages a day is more than ten books a year.", "source": "Daily reading"}, "de": {"if_text": "Wenn ich ins Bett gehe", "then_text": "10 Seiten in einem Buch, ohne Bildschirm", "why": "Zehn Seiten am Tag sind mehr als zehn Bücher im Jahr.", "source": "Tägliches Lesen"}, "es": {"if_text": "Si me acuesto", "then_text": "10 páginas de un libro, sin pantallas", "why": "Diez páginas al día son más de diez libros al año.", "source": "Lectura diaria"}}'::jsonb where code = 'lecture';
update public.principle_templates set i18n = '{"en": {"if_text": "If my day is ending", "then_text": "3 lines: what I did, what I learned, what I''ll change tomorrow", "why": "Seneca reviewed his day every evening. You improve by watching yourself work.", "source": "Seneca, On Anger (the evening review)"}, "de": {"if_text": "Wenn mein Tag endet", "then_text": "3 Zeilen: was ich getan habe, was ich gelernt habe, was ich morgen ändere", "why": "Seneca ging jeden Abend seinen Tag durch. Man wird besser, indem man sich selbst beobachtet.", "source": "Seneca, Über den Zorn (die abendliche Prüfung)"}, "es": {"if_text": "Si termina mi día", "then_text": "3 líneas: qué hice, qué aprendí, qué cambio mañana", "why": "Séneca repasaba su día cada noche. Se progresa observándose a uno mismo.", "source": "Séneca, Sobre la ira (el examen nocturno)"}}'::jsonb where code = 'journal';
update public.principle_templates set i18n = '{"en": {"if_text": "If I''m starting my day", "then_text": "10 minutes of silence, no phone", "why": "A few minutes of calm train your attention like a muscle.", "source": "Mindfulness (Jon Kabat-Zinn)"}, "de": {"if_text": "Wenn ich meinen Tag beginne", "then_text": "10 Minuten Stille, ohne Handy", "why": "Ein paar Minuten Ruhe trainieren die Aufmerksamkeit wie einen Muskel.", "source": "Achtsamkeit (Jon Kabat-Zinn)"}, "es": {"if_text": "Si empiezo mi día", "then_text": "10 minutos de silencio, sin móvil", "why": "Unos minutos de calma entrenan la atención como un músculo.", "source": "Atención plena (Jon Kabat-Zinn)"}}'::jsonb where code = 'silence';
update public.principle_templates set i18n = '{"en": {"if_text": "If it''s a weekday", "then_text": "25 minutes learning a skill for my project", "why": "Practising what you can''t do yet is what makes you improve.", "source": "Anders Ericsson, deliberate practice"}, "de": {"if_text": "Wenn Werktag ist", "then_text": "25 Minuten, um eine Fähigkeit für mein Projekt zu lernen", "why": "Das zu üben, was man noch nicht kann, bringt einen weiter.", "source": "Anders Ericsson, bewusstes Üben"}, "es": {"if_text": "Si es día laborable", "then_text": "25 minutos para aprender una habilidad de mi proyecto", "why": "Entrenar lo que aún no sabes hacer es lo que te hace progresar.", "source": "Anders Ericsson, práctica deliberada"}}'::jsonb where code = 'apprendre';
update public.principle_templates set i18n = '{"en": {"if_text": "If I feel like complaining", "then_text": "I look for what depends on me and do it", "why": "Focus only on what depends on you: that''s where your strength lies.", "source": "Epictetus, Enchiridion"}, "de": {"if_text": "Wenn ich mich beschweren will", "then_text": "suche ich, was von mir abhängt, und tue es", "why": "Kümmere dich nur um das, was von dir abhängt: Dort liegt deine Stärke.", "source": "Epiktet, Handbüchlein der Moral"}, "es": {"if_text": "Si tengo ganas de quejarme", "then_text": "busco lo que depende de mí y lo hago", "why": "Ocúpate solo de lo que depende de ti: ahí está tu fuerza.", "source": "Epicteto, Enquiridión"}}'::jsonb where code = 'ce_qui_depend';
update public.principle_templates set i18n = '{"en": {"if_text": "If I''ve finished a chapter", "then_text": "one revision sheet, photographed", "why": "Summarising in your own words forces you to understand.", "source": "Active learning"}, "de": {"if_text": "Wenn ich ein Kapitel fertig habe", "then_text": "ein Lernzettel, fotografiert", "why": "In eigenen Worten zusammenzufassen zwingt zum Verstehen.", "source": "Aktives Lernen"}, "es": {"if_text": "Si he terminado un tema", "then_text": "una ficha de repaso, con foto", "why": "Resumir con tus palabras te obliga a entender.", "source": "Aprendizaje activo"}}'::jsonb where code = 'fiches';
