-- V2 · Logique du jeu, côté serveur uniquement.
-- Les fonctions publiques sont SECURITY DEFINER et vérifient tout : propriétaire, abonnement, jour, heure du serveur.
-- Les fonctions préfixées par _ sont internes (aucun droit d'exécution pour les clients).
-- Valeurs de points : les mêmes que lib/rules.ts (à garder synchronisées).

-- ===========================================================================
-- Plans et accès
-- ===========================================================================

-- Plan effectif d'un utilisateur, ou null s'il n'a pas accès.
-- Pro (abonnement) et Fondateur (à vie) couvrent tous les arcs ; l'Arc 90 jours couvre l'arc ouvert qu'il a payé.
create function public._plan(p_user uuid) returns text
language sql stable set search_path = '' as $$
  with p as (select * from public.profiles where id = p_user),
  paid as (
    select case
      when p.plan = 'fondateur' and p.plan_status = 'lifetime' then 'fondateur'
      when p.plan = 'pro' and p.plan_status in ('active', 'trialing', 'past_due') then 'pro'
    end as plan
    from p
  ),
  comp as (
    select case when p.comp_until is not null and p.comp_until >= public.paris_today() then p.comp_plan end as plan from p
  ),
  pass as (
    select 'arc'::text as plan from public.enrollments e
    where e.user_id = p_user and e.status in ('draft', 'active') and e.arc_paid
    limit 1
  )
  select coalesce(
    (select plan from paid),
    case when (select plan from comp) = 'pro' then 'pro' end,
    (select plan from pass),
    (select plan from comp)
  );
$$;

-- Limites d'un plan. Sans plan (arc en construction) : on construit librement, mais rien ne se valide.
create function public._limits(p_plan text) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when p_plan in ('pro', 'fondateur') then '{"max_principles":12,"jokers":3,"wallet":true,"create_squad":true}'::jsonb
    when p_plan = 'arc' then '{"max_principles":6,"jokers":1,"wallet":false,"create_squad":false}'::jsonb
    else '{"max_principles":12,"jokers":0,"wallet":false,"create_squad":false}'::jsonb
  end;
$$;

-- Arc ouvert (en construction ou en cours), sinon null.
create function public._open_enrollment(p_user uuid) returns public.enrollments
language sql stable set search_path = '' as $$
  select e.* from public.enrollments e
  where e.user_id = p_user and e.status in ('draft', 'active')
  limit 1;
$$;

-- Arc ouvert, sinon le plus récent.
create function public._current_enrollment(p_user uuid) returns public.enrollments
language sql stable set search_path = '' as $$
  select e.* from public.enrollments e
  where e.user_id = p_user
  order by case when e.status in ('draft', 'active') then 0 else 1 end, e.arc_number desc
  limit 1;
$$;

-- Un principe est-il dû ce jour-là ? (version en vigueur et jour de la semaine)
create function public._on_day(p_from date, p_until date, p_days int[], p_day date) returns boolean
language sql immutable set search_path = '' as $$
  select p_day >= p_from and (p_until is null or p_day <= p_until) and extract(isodow from p_day)::int = any(p_days);
$$;

create function public._award(p_enrollment uuid, p_user uuid, p_day date, p_delta int, p_reason text, p_ref uuid)
returns boolean
language plpgsql set search_path = '' as $$
begin
  if p_delta = 0 then
    return false;
  end if;
  insert into public.points_ledger (enrollment_id, user_id, day, delta, reason, ref_id)
  values (p_enrollment, p_user, p_day, p_delta, p_reason, p_ref)
  on conflict (reason, ref_id) do nothing;
  return found;
end;
$$;

-- ===========================================================================
-- Principes : cible, difficulté, textes
-- ===========================================================================

-- Vérifie et normalise la cible d'une preuve.
create function public._clean_target(p_proof text, p_target jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v jsonb := coalesce(p_target, '{}'::jsonb);
  v_out jsonb := '{}'::jsonb;
  v_n int;
  v_t time;
  v_unit text;
  v_domains text[];
begin
  if jsonb_typeof(v) <> 'object' then
    raise exception 'Cible invalide.';
  end if;
  case p_proof
    when 'session' then
      v_n := case when v ->> 'minutes' ~ '^\d{1,3}$' then (v ->> 'minutes')::int end;
      if v_n is null or v_n not in (25, 50, 90) then
        raise exception 'Durée de session : 25, 50 ou 90 minutes.';
      end if;
      v_out := jsonb_build_object('minutes', v_n);
      if v ? 'before' and v ->> 'before' is not null then
        v_t := public._hhmm(v ->> 'before');
        if v_t is null or v_t < '06:00' then
          raise exception 'Heure limite invalide.';
        end if;
        v_out := v_out || jsonb_build_object('before', to_char(v_t, 'HH24:MI'));
      end if;
    when 'reps' then
      v_n := case when v ->> 'reps' ~ '^\d{1,3}$' then (v ->> 'reps')::int end;
      if coalesce(v ->> 'exercise', '') not in ('pushup', 'squat') then
        raise exception 'Exercice : pompes ou squats.';
      end if;
      if v_n is null or v_n < 5 or v_n > 300 then
        raise exception 'Nombre de répétitions : de 5 à 300.';
      end if;
      v_out := jsonb_build_object('exercise', v ->> 'exercise', 'reps', v_n);
    when 'reveil' then
      v_t := public._hhmm(v ->> 'before');
      if v_t is null or v_t < '04:00' or v_t > '10:00' then
        raise exception 'Heure de lever : entre 4 h et 10 h, au quart d''heure.';
      end if;
      v_out := jsonb_build_object('before', to_char(v_t, 'HH24:MI'));
    when 'photo' then
      if v ? 'after' and v ->> 'after' is not null then
        v_t := public._hhmm(v ->> 'after');
        if v_t is null then
          raise exception 'Heure invalide.';
        end if;
        v_out := jsonb_build_object('after', to_char(v_t, 'HH24:MI'));
      end if;
    when 'lien' then
      if v ? 'domains' and jsonb_typeof(v -> 'domains') = 'array' then
        v_domains := array(select distinct lower(btrim(x)) from jsonb_array_elements_text(v -> 'domains') x);
        if exists (select 1 from unnest(v_domains) d where not (d = any(public._link_domains()))) then
          raise exception 'Domaine non pris en charge.';
        end if;
        if cardinality(v_domains) > 0 then
          v_out := jsonb_build_object('domains', to_jsonb(v_domains));
        end if;
      end if;
    when 'capture', 'declaratif' then
      null;
    else
      raise exception 'Type de preuve invalide.';
  end case;
  -- Objectif chiffré facultatif, affiché (ex. 20 messages) : preuves faibles seulement.
  if p_proof in ('capture', 'declaratif', 'photo', 'lien') and v ? 'count' and v ->> 'count' is not null then
    v_n := case when v ->> 'count' ~ '^\d{1,4}$' then (v ->> 'count')::int end;
    v_unit := nullif(btrim(coalesce(v ->> 'unit', '')), '');
    if v_n is null or v_n < 1 or v_n > 1000 or length(coalesce(v_unit, '')) > 20 then
      raise exception 'Objectif chiffré invalide.';
    end if;
    v_out := v_out || jsonb_build_object('count', v_n) || case when v_unit is not null then jsonb_build_object('unit', v_unit) else '{}'::jsonb end;
  end if;
  return v_out;
end;
$$;

-- Difficulté calculée par le serveur. Preuves faibles : 1 ou 2 au choix.
create function public._difficulty(p_proof text, p_target jsonb, p_requested int) returns int
language plpgsql immutable set search_path = '' as $$
declare
  v_n int;
  v_t time;
begin
  case p_proof
    when 'session' then
      v_n := (p_target ->> 'minutes')::int;
      return case when v_n <= 25 then 1 when v_n <= 50 then 2 else 3 end;
    when 'reps' then
      v_n := (p_target ->> 'reps')::int;
      if p_target ->> 'exercise' = 'squat' then
        return case when v_n <= 25 then 1 when v_n <= 60 then 2 else 3 end;
      end if;
      return case when v_n <= 15 then 1 when v_n <= 40 then 2 else 3 end;
    when 'reveil' then
      v_t := (p_target ->> 'before')::time;
      return case when v_t >= '07:30' then 1 when v_t >= '06:30' then 2 else 3 end;
    else
      return least(greatest(coalesce(p_requested, 1), 1), 2);
  end case;
end;
$$;

-- « je m'assois à mon bureau » → « Si je m'assois à mon bureau » ; « il est 7 h » → « S'il est 7 h ».
create function public._if_text(p_text text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g');
begin
  v := rtrim(v, ',');
  if v ~* '^(si |s''|s’)' then
    v := upper(left(v, 1)) || substr(v, 2);
  elsif v ~* '^il ' then
    v := 'S''' || v;
  else
    v := 'Si ' || v;
  end if;
  if length(v) < 4 or length(v) > 120 then
    raise exception 'Le « si » : de 2 à 110 caractères.';
  end if;
  return v;
end;
$$;

create function public._then_text(p_text text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g');
begin
  v := regexp_replace(v, '^alors\s+', '', 'i');
  v := rtrim(v, '.');
  if length(v) < 2 or length(v) > 150 then
    raise exception 'Le « alors » : de 2 à 150 caractères.';
  end if;
  return 'alors ' || v || '.';
end;
$$;

-- Jour à partir duquel une modification de principe s'applique.
create function public._effective_day(e public.enrollments) returns date
language sql stable set search_path = '' as $$
  select case
    when e.status = 'active' and public.paris_today() >= e.start_date then public.paris_today() + 1
    else e.start_date
  end;
$$;

-- Principes en vigueur à une date (tous les jours de la semaine confondus).
create function public._principles_count_at(p_enrollment uuid, p_day date) returns int
language sql stable set search_path = '' as $$
  select count(*)::int from public.principles
  where enrollment_id = p_enrollment and active_from <= p_day and (active_until is null or active_until >= p_day);
$$;

-- Crée ou modifie un principe. Pendant l'arc, la modification devient une nouvelle version dès le lendemain.
create function public._save_principle(
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
    values (e.id, v_pos, p_pillar, public._if_text(p_if), public._then_text(p_then), p_proof_type, v_diff, v_days,
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
    set pillar = p_pillar, if_text = public._if_text(p_if), then_text = public._then_text(p_then),
        proof_type = p_proof_type, difficulty = v_diff, days = v_days, target = v_target
    where id = p.id;
    return p.id;
  end if;
  -- En vigueur : l'ancienne version s'arrête ce soir, la nouvelle commence demain.
  update public.principles set active_until = v_eff - 1 where id = p.id;
  insert into public.principles (enrollment_id, position, pillar, if_text, then_text, proof_type, difficulty, days,
    target, source, template_code, why, active_from)
  values (e.id, p.position, p_pillar, public._if_text(p_if), public._then_text(p_then), p_proof_type, v_diff, v_days,
    v_target, p.source, p.template_code, p.why, v_eff)
  returning id into v_id;
  return v_id;
end;
$$;

-- Gabarit personnalisé avec les réponses du questionnaire (heure de lever, durée de concentration, pompes).
create function public._render_template(p_code text, p_wake time, p_focus int, p_pushups text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  t public.principle_templates;
  v_target jsonb;
  v_if text;
  v_then text;
  v_reps int;
begin
  select * into t from public.principle_templates where code = p_code;
  if t.code is null then
    return null;
  end if;
  v_target := t.target;
  v_if := t.if_text;
  v_then := t.then_text;
  if t.proof_type = 'reveil' then
    v_target := jsonb_build_object('before', to_char(p_wake, 'HH24:MI'));
    v_if := 'S''il est ' || public._time_fr(p_wake);
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
    'why', t.why, 'source', t.source);
end;
$$;

-- Ajoute un gabarit à l'arc ouvert, personnalisé avec les réponses de l'onboarding.
create function public._add_template(p_user uuid, p_code text) returns uuid
language plpgsql set search_path = '' as $$
declare
  e public.enrollments := public._open_enrollment(p_user);
  r jsonb;
begin
  if e.id is null then
    raise exception 'Gabarit introuvable.';
  end if;
  r := public._render_template(p_code, e.wake_time, e.focus_minutes, e.pushups);
  if r is null then
    raise exception 'Gabarit introuvable.';
  end if;
  return public._save_principle(p_user, null, r ->> 'pillar', r ->> 'if_text', r ->> 'then_text', r ->> 'proof_type',
    r -> 'target', array(select jsonb_array_elements_text(r -> 'days')::int), (r ->> 'difficulty')::int, p_code, r ->> 'why');
end;
$$;

-- Choisit 6 gabarits selon l'objectif, les points faibles et le profil.
create function public._pick_templates(p_category text, p_goal_type text, p_weak text[], p_pushups text) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  v_codes text[];
  v_pillars text[];
  v_code text;
  r record;
begin
  -- Socle : réveil fixe, travail profond, corps.
  v_codes := array['reveil_fixe', 'bloc_profond', case when p_pushups = 'non' then 'squats' else 'pompes' end];
  v_pillars := array['energie', 'focus', 'corps'];

  -- Un principe business dès que l'objectif touche au projet.
  if p_goal_type in ('revenu', 'clients', 'lancement', 'audience') then
    select t.code into v_code from public.principle_templates t
    where t.pillar = 'business' and p_goal_type = any(t.goal_types) and p_category = any(t.categories)
    order by (select count(*) from unnest(t.weak_points) w where w = any(p_weak)) desc, t.sort
    limit 1;
    if v_code is not null then
      v_codes := v_codes || v_code;
      v_pillars := v_pillars || 'business'::text;
    end if;
  end if;

  -- Puis les mieux notés : objectif (5), points faibles (3), profil (1), sans doubler un pilier plus de 2 fois.
  for r in
    select t.code, t.pillar,
      (case when p_goal_type = any(t.goal_types) then 5 else 0 end)
      + 3 * (select count(*) from unnest(t.weak_points) w where w = any(p_weak))
      + (case when p_category = any(t.categories) then 1 else -10 end) as score
    from public.principle_templates t
    where t.code not in ('reveil_fixe', 'bloc_profond', 'pompes', 'squats')
    order by 3 desc, t.sort
  loop
    exit when cardinality(v_codes) >= 6;
    continue when r.code = any(v_codes) or r.score <= 0;
    continue when (select count(*) from unnest(v_pillars) x where x = r.pillar) >= 2;
    v_codes := v_codes || r.code;
    v_pillars := v_pillars || r.pillar;
  end loop;
  return v_codes;
end;
$$;

-- Propose 6 principes selon l'objectif, les points faibles et le profil. Tout reste modifiable.
create function public._generate_principles(p_enrollment uuid) returns void
language plpgsql set search_path = '' as $$
declare
  e public.enrollments;
  v_code text;
begin
  select * into e from public.enrollments where id = p_enrollment;
  delete from public.principles where enrollment_id = e.id;
  foreach v_code in array public._pick_templates(e.category, e.goal_type, e.weak_points, e.pushups) loop
    perform public._add_template(e.user_id, v_code);
  end loop;
end;
$$;

-- Aperçu des principes pour un visiteur (questionnaire, avant tout compte). N'écrit rien.
create function public.preview_principles(
  p_category text,
  p_goal_type text,
  p_weak_points text[],
  p_wake_time text,
  p_pushups text,
  p_focus_minutes int
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
    r := public._render_template(v_code, v_wake, p_focus_minutes, p_pushups);
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'code', r ->> 'code', 'pillar', r ->> 'pillar',
      'if_text', public._if_text(r ->> 'if_text'), 'then_text', public._then_text(r ->> 'then_text'),
      'proof_type', r ->> 'proof_type', 'days', r -> 'days', 'why', r ->> 'why', 'source', r ->> 'source',
      'difficulty', public._difficulty(r ->> 'proof_type', public._clean_target(r ->> 'proof_type', r -> 'target'),
        (r ->> 'difficulty')::int)));
  end loop;
  return jsonb_build_object('principles', v_out, 'templates', (select count(*) from public.principle_templates));
end;
$$;

-- ===========================================================================
-- Profil et arc
-- ===========================================================================
create function public.save_profile(
  p_pseudo text,
  p_birth_year int,
  p_adult boolean,
  p_is_public boolean,
  p_utm_source text default null,
  p_utm_campaign text default null
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
  insert into public.profiles (id, pseudo, birth_year, is_public, referral_code, utm_source, utm_campaign)
  values (v_user, v_pseudo, p_birth_year, coalesce(p_is_public, false), upper(replace(v_pseudo, '_', '-')),
    left(p_utm_source, 100), left(p_utm_campaign, 100));
  insert into public.player_stats (user_id) values (v_user) on conflict do nothing;
end;
$$;

-- Lance un arc construit dès que l'accès est là (Arc 90 jours payé, abonnement Pro, Fondateur ou accès offert).
create function public._activate_enrollment(p_enrollment uuid) returns boolean
language plpgsql set search_path = '' as $$
declare
  e public.enrollments;
  v_start date;
  v_max int;
begin
  select * into e from public.enrollments where id = p_enrollment for update;
  if e.id is null or e.status <> 'draft' or public._plan(e.user_id) is null then
    return false;
  end if;
  v_start := greatest(e.start_date, public.paris_today());
  update public.enrollments set status = 'active', activated_at = now(), start_date = v_start where id = e.id;
  update public.principles set active_from = v_start where enrollment_id = e.id and active_from < v_start;
  -- Arc 90 jours : on garde les premiers principes dans la limite du plan.
  v_max := (public._limits(public._plan(e.user_id)) ->> 'max_principles')::int;
  delete from public.principles where id in (
    select id from public.principles where enrollment_id = e.id order by position offset v_max
  );
  insert into public.player_stats (user_id) values (e.user_id) on conflict do nothing;
  return true;
end;
$$;

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
  p_squad_id uuid default null
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
      goal_unit, goal_public, weak_points, wake_time, pushups, focus_minutes, utm_source, utm_campaign)
    select v_user, v_number, v_start, p_category, p_goal_type, v_goal, p_goal_target, v_unit, coalesce(p_goal_public, false),
      v_weak, v_wake, p_pushups, p_focus_minutes, pr.utm_source, pr.utm_campaign
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
        pushups = p_pushups, focus_minutes = p_focus_minutes, start_date = v_start
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

-- Reprend les principes proposés (seulement avant le jour 1).
create function public.regenerate_principles() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._open_enrollment(v_user);
begin
  if e.id is null or not (e.status = 'draft' or public.paris_today() < e.start_date) then
    raise exception 'Ton arc a commencé : modifie tes principes un par un.';
  end if;
  perform public._generate_principles(e.id);
end;
$$;

-- Change le jour 1 (avant le départ seulement).
create function public.set_start_date(p_date date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_today date := public.paris_today();
  e public.enrollments := public._open_enrollment(v_user);
begin
  if e.id is null or not (e.status = 'draft' or v_today < e.start_date) then
    raise exception 'Ton arc a déjà commencé.';
  end if;
  if p_date is null or p_date < v_today or p_date > v_today + 120 then
    raise exception 'Choisis un jour 1 entre aujourd''hui et les 4 prochains mois.';
  end if;
  update public.enrollments set start_date = p_date where id = e.id;
  update public.principles set active_from = p_date where enrollment_id = e.id;
end;
$$;

-- Lance l'arc si l'abonnement vient d'être activé (appelé au retour du paiement et au tableau de bord).
create function public.activate_my_arc() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._open_enrollment(v_user);
begin
  if e.id is null then
    return false;
  end if;
  return public._activate_enrollment(e.id);
end;
$$;

-- ===========================================================================
-- Principes (onglet Principes)
-- ===========================================================================
create function public.save_principle(
  p_id uuid,
  p_pillar text,
  p_if text,
  p_then text,
  p_proof_type text,
  p_target jsonb,
  p_days int[],
  p_difficulty int default 1
) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  return public._save_principle(public._require_user(), p_id, p_pillar, p_if, p_then, p_proof_type, p_target, p_days,
    p_difficulty, null, null);
end;
$$;

create function public.add_template_principle(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  return public._add_template(public._require_user(), p_code);
end;
$$;

create function public.remove_principle(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._open_enrollment(v_user);
  v_eff date;
  p public.principles;
begin
  if e.id is null then
    raise exception 'Principe introuvable.';
  end if;
  v_eff := public._effective_day(e);
  select * into p from public.principles where id = p_id and enrollment_id = e.id;
  if p.id is null or (p.active_until is not null and p.active_until < v_eff) then
    raise exception 'Principe introuvable.';
  end if;
  if public._principles_count_at(e.id, v_eff) <= 1 then
    raise exception 'Garde au moins un principe.';
  end if;
  if p.active_from >= v_eff then
    delete from public.principles where id = p.id;
  else
    update public.principles set active_until = v_eff - 1 where id = p.id;
  end if;
end;
$$;

-- ===========================================================================
-- Validations
-- ===========================================================================
create function public._create_validation(
  p_user uuid,
  p_principle uuid,
  p_day date,
  p_proof_type text,
  p_strength text,
  p_session uuid,
  p_photo text,
  p_link text
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  p public.principles;
  e public.enrollments;
  v_today date := public.paris_today();
  v_value int;
  v_points int;
  v_id uuid;
  v_audit boolean := false;
begin
  select * into p from public.principles where id = p_principle;
  if p.id is not null then
    select * into e from public.enrollments where id = p.enrollment_id;
  end if;
  if p.id is null or e.user_id <> p_user then
    raise exception 'Principe introuvable.';
  end if;
  if e.status <> 'active' then
    raise exception 'Ton arc n''est pas en cours.';
  end if;
  if public._plan(p_user) is null then
    raise exception 'Ton abonnement est inactif : réactive-le pour valider.';
  end if;
  if p_day < e.start_date or p_day > e.end_date then
    raise exception 'Ce jour ne fait pas partie de ton arc.';
  end if;
  -- Aucune validation rétroactive. Seule exception : une session commencée avant minuit.
  if p_day <> v_today and not (p_session is not null and p_day = v_today - 1) then
    raise exception 'Trop tard : un principe se valide le jour même, avant minuit.';
  end if;
  if exists (select 1 from public.day_status where enrollment_id = e.id and day = p_day) then
    raise exception 'Trop tard : cette journée est close.';
  end if;
  if not public._on_day(p.active_from, p.active_until, p.days, p_day) then
    raise exception 'Ce principe n''est pas prévu aujourd''hui.';
  end if;
  if exists (select 1 from public.validations where principle_id = p.id and day = p_day) then
    raise exception 'Déjà validé aujourd''hui.';
  end if;

  v_value := 10 * p.difficulty;
  -- Preuve forte : 100 % des points. Preuve faible : 50 %.
  v_points := case when p_strength = 'forte' then v_value else round(v_value * 0.5)::int end;

  insert into public.validations (enrollment_id, principle_id, day, pillar, proof_type, strength, points,
    proof_session_id, photo_path, link_url)
  values (e.id, p.id, p_day, p.pillar, p_proof_type, p_strength, v_points, p_session, p_photo, p_link)
  returning id into v_id;

  perform public._award(e.id, p_user, p_day, v_points, 'validation', v_id);

  -- Contrôle aléatoire sur les preuves faibles.
  if p_strength = 'faible' and random() < public._audit_rate() then
    insert into public.audits (validation_id, enrollment_id, user_id, due_at, penalty)
    values (v_id, e.id, p_user, now() + interval '24 hours', 3 * v_value);
    update public.validations set status = 'audit_pending' where id = v_id;
    v_audit := true;
  end if;

  perform public._after_change(p_user);
  return jsonb_build_object('validation_id', v_id, 'points', v_points, 'audit', v_audit);
end;
$$;

-- Principe de l'utilisateur, sinon « introuvable » (sans rien révéler du principe d'un autre).
create function public._owned_principle(p_user uuid, p_principle uuid) returns public.principles
language plpgsql stable set search_path = '' as $$
declare
  p public.principles;
begin
  select pr.* into p from public.principles pr
  join public.enrollments e on e.id = pr.enrollment_id
  where pr.id = p_principle and e.user_id = p_user;
  if p.id is null then
    raise exception 'Principe introuvable.';
  end if;
  return p;
end;
$$;

-- Bouton « Fait » (déclaratif), ou repli sans caméra pour les répétitions (50 % des points).
create function public.validate_declaratif(p_principle_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  p public.principles := public._owned_principle(v_user, p_principle_id);
begin
  if p.proof_type not in ('declaratif', 'reps') then
    raise exception 'Ce principe demande une autre preuve.';
  end if;
  return public._create_validation(v_user, p.id, public.paris_today(), 'declaratif', 'faible', null, null, null);
end;
$$;

create function public.validate_link(p_principle_id uuid, p_url text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  p public.principles := public._owned_principle(v_user, p_principle_id);
  v_link text;
begin
  if p.proof_type <> 'lien' then
    raise exception 'Ce principe demande une autre preuve.';
  end if;
  v_link := public._normalize_link(p_url, array(select jsonb_array_elements_text(coalesce(p.target -> 'domains', '[]'))));
  if exists (select 1 from public.validations where link_url = v_link)
    or exists (select 1 from public.challenge_proofs where link_url = v_link) then
    raise exception 'Ce lien a déjà servi.';
  end if;
  return public._create_validation(v_user, p.id, public.paris_today(), 'lien', 'faible', null, null, v_link);
end;
$$;

-- Photo ou capture vérifiée, ré-encodée et déposée par le serveur.
create function public._check_proof_file(p_user uuid, p_path text) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_path !~ ('^' || p_user::text || '/[0-9a-f-]{36}\.jpg$') or not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'proofs' and o.name = p_path and o.created_at > now() - interval '15 minutes'
  ) then
    raise exception 'Photo introuvable.';
  end if;
end;
$$;

create function public.validate_photo(p_user uuid, p_principle_id uuid, p_path text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.principles := public._owned_principle(p_user, p_principle_id);
begin
  if p.proof_type not in ('photo', 'capture') then
    raise exception 'Ce principe demande une autre preuve.';
  end if;
  if p.target ? 'after' and public.paris_now()::time < (p.target ->> 'after')::time then
    raise exception 'Ce principe se prouve à partir de %.', public._time_fr((p.target ->> 'after')::time);
  end if;
  perform public._check_proof_file(p_user, p_path);
  return public._create_validation(p_user, p.id, public.paris_today(), p.proof_type, 'faible', null, p_path, null);
end;
$$;

-- ===========================================================================
-- Sessions de preuve : concentration, répétitions, réveil
-- ===========================================================================
create function public._break_session(p_session uuid, p_reason text) returns void
language plpgsql set search_path = '' as $$
declare
  s public.proof_sessions;
begin
  update public.proof_sessions
  set status = 'broken', ended_at = now(), data = data || jsonb_build_object('reason', p_reason)
  where id = p_session and status = 'running'
  returning * into s;
  -- Session de concentration cassée : − 5.
  if s.id is not null and s.kind = 'session' then
    perform public._award(s.enrollment_id, s.user_id, s.day, -5, 'session_broken', s.id);
  end if;
end;
$$;

-- Nettoie les sessions en cours d'un utilisateur avant d'en ouvrir une nouvelle.
create function public._settle_user_sessions(p_user uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_id uuid;
begin
  update public.proof_sessions set status = 'expired', ended_at = now()
  where user_id = p_user and status = 'running' and kind in ('reps', 'reveil');
  for v_id in
    select id from public.proof_sessions
    where user_id = p_user and status = 'running' and kind = 'session'
      and coalesce(last_heartbeat_at, started_at) < now() - interval '45 seconds'
  loop
    perform public._break_session(v_id, 'Les battements se sont arrêtés.');
  end loop;
end;
$$;

create function public.start_proof_session(p_principle_id uuid) returns jsonb
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
    v_code := public._six_digits();
    v_data := jsonb_build_object('code_hash', encode(sha256(convert_to(v_code, 'UTF8')), 'hex'), 'attempts', 0);
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
    'started_at', s.started_at, 'server_now', now(), 'code', v_code, 'target', p.target
  );
end;
$$;

-- Battement toutes les 15 s. Page cachée plus de 10 s, ou plus de 45 s sans battement : la session casse.
create function public.heartbeat(p_session_id uuid, p_nonce text, p_visible boolean, p_hidden_ms int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  s public.proof_sessions;
  v_last timestamptz;
begin
  select * into s from public.proof_sessions where id = p_session_id for update;
  if s.id is null or s.user_id <> v_user or s.nonce <> p_nonce or s.kind <> 'session' then
    raise exception 'Session introuvable.';
  end if;
  if s.status <> 'running' then
    return jsonb_build_object('status', s.status, 'reason', s.data ->> 'reason');
  end if;
  v_last := coalesce(s.last_heartbeat_at, s.started_at);
  if now() - v_last > interval '45 seconds' then
    perform public._break_session(s.id, 'Les battements se sont arrêtés.');
    return jsonb_build_object('status', 'broken', 'reason', 'Les battements se sont arrêtés.');
  end if;
  if not coalesce(p_visible, false) or coalesce(p_hidden_ms, 0) > 10000 then
    perform public._break_session(s.id, 'Tu as quitté l''écran.');
    return jsonb_build_object('status', 'broken', 'reason', 'Tu as quitté l''écran.');
  end if;
  -- Un battement ne compte que s'il arrive au moins 10 s après le précédent.
  if s.last_heartbeat_at is null or now() - s.last_heartbeat_at >= interval '10 seconds' then
    update public.proof_sessions
    set heartbeats = heartbeats + 1, last_heartbeat_at = now()
    where id = s.id
    returning * into s;
  end if;
  return jsonb_build_object(
    'status', 'running', 'heartbeats', s.heartbeats,
    'elapsed', floor(extract(epoch from now() - s.started_at))::int
  );
end;
$$;

create function public.abandon_session(p_session_id uuid, p_nonce text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  s public.proof_sessions;
begin
  select * into s from public.proof_sessions where id = p_session_id for update;
  if s.id is null or s.user_id <> v_user or s.nonce <> p_nonce then
    raise exception 'Session introuvable.';
  end if;
  if s.status <> 'running' then
    return jsonb_build_object('status', s.status);
  end if;
  if s.kind = 'session' then
    update public.proof_sessions set status = 'abandoned', ended_at = now() where id = s.id;
    perform public._award(s.enrollment_id, s.user_id, s.day, -5, 'session_broken', s.id);
  else
    update public.proof_sessions set status = 'expired', ended_at = now() where id = s.id;
  end if;
  return jsonb_build_object('status', case when s.kind = 'session' then 'abandoned' else 'expired' end);
end;
$$;

create function public.complete_session(p_session_id uuid, p_nonce text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  s public.proof_sessions;
  v_required int;
  v_expected int;
  v_result jsonb;
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

  if s.principle_id is not null then
    v_result := public._create_validation(s.user_id, s.principle_id, s.day, 'session', 'forte', s.id, null, null);
  elsif s.challenge_assignment_id is not null then
    perform public._evaluate_assignment(s.challenge_assignment_id, false);
    perform public._after_change(s.user_id);
  end if;
  return jsonb_build_object('status', 'completed', 'validation', v_result);
end;
$$;

-- Répétitions comptées sur l'appareil : le serveur ne reçoit que [début, fin] en ms de chaque répétition.
create function public.complete_reps(p_session_id uuid, p_nonce text, p_reps jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  s public.proof_sessions;
  p public.principles;
  v_count int;
  v_elapsed_ms numeric;
  v_prev_end numeric := 0;
  v_start numeric;
  v_end numeric;
  v_rep jsonb;
  v_reason text;
  v_target int;
  v_result jsonb;
begin
  select * into s from public.proof_sessions where id = p_session_id for update;
  if s.id is null or s.user_id <> v_user or s.nonce <> p_nonce or s.kind <> 'reps' then
    raise exception 'Session introuvable.';
  end if;
  if s.status <> 'running' then
    return jsonb_build_object('status', s.status);
  end if;
  if jsonb_typeof(p_reps) <> 'array' or jsonb_array_length(p_reps) > 1000 then
    raise exception 'Données de répétitions invalides.';
  end if;

  v_count := jsonb_array_length(p_reps);
  v_elapsed_ms := extract(epoch from now() - s.started_at) * 1000;
  for v_rep in select value from jsonb_array_elements(p_reps) loop
    if jsonb_typeof(v_rep) <> 'array' or jsonb_array_length(v_rep) <> 2
      or jsonb_typeof(v_rep -> 0) <> 'number' or jsonb_typeof(v_rep -> 1) <> 'number' then
      raise exception 'Données de répétitions invalides.';
    end if;
    v_start := (v_rep ->> 0)::numeric;
    v_end := (v_rep ->> 1)::numeric;
    -- Une répétition dure entre 0,8 s et 6 s, sans chevauchement, et pas dans le futur.
    if v_end - v_start < 800 then
      v_reason := 'Une répétition a duré moins de 0,8 s.';
    elsif v_end - v_start > 6000 then
      v_reason := 'Une répétition a duré plus de 6 s.';
    elsif v_start < v_prev_end or v_start < 0 then
      v_reason := 'Répétitions incohérentes.';
    elsif v_end > v_elapsed_ms + 2000 then
      v_reason := 'Répétitions incohérentes avec la durée de la session.';
    end if;
    exit when v_reason is not null;
    v_prev_end := v_end;
  end loop;

  if s.principle_id is not null then
    select * into p from public.principles where id = s.principle_id;
    v_target := coalesce((p.target ->> 'reps')::int, 1);
    if v_reason is null and v_count < v_target then
      v_reason := format('Objectif non atteint : %s sur %s.', v_count, v_target);
    end if;
  end if;

  if v_reason is not null then
    update public.proof_sessions
    set status = 'expired', ended_at = now(), data = data || jsonb_build_object('reason', v_reason, 'count', v_count)
    where id = s.id;
    return jsonb_build_object('status', 'rejected', 'reason', v_reason);
  end if;

  update public.proof_sessions
  set status = 'completed', ended_at = now(), data = data || jsonb_build_object('count', v_count, 'reps', p_reps)
  where id = s.id;

  if s.principle_id is not null then
    v_result := public._create_validation(s.user_id, s.principle_id, s.day, 'reps', 'forte', s.id, null, null);
  else
    perform public._evaluate_assignment(s.challenge_assignment_id, false);
    perform public._after_change(s.user_id);
  end if;
  return jsonb_build_object('status', 'completed', 'count', v_count, 'validation', v_result);
end;
$$;

create function public.complete_wake_check(p_session_id uuid, p_nonce text, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  s public.proof_sessions;
  p public.principles;
  ch public.challenges;
  v_before time;
  v_attempts int;
  v_result jsonb;
begin
  select * into s from public.proof_sessions where id = p_session_id for update;
  if s.id is null or s.user_id <> v_user or s.nonce <> p_nonce or s.kind <> 'reveil' then
    raise exception 'Session introuvable.';
  end if;
  if s.status <> 'running' then
    return jsonb_build_object('status', s.status);
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

  v_attempts := coalesce((s.data ->> 'attempts')::int, 0) + 1;
  update public.proof_sessions set data = data || jsonb_build_object('attempts', v_attempts) where id = s.id;
  if encode(sha256(convert_to(btrim(coalesce(p_code, '')), 'UTF8')), 'hex') <> s.data ->> 'code_hash' then
    if v_attempts >= 5 then
      update public.proof_sessions set status = 'expired', ended_at = now() where id = s.id;
      return jsonb_build_object('status', 'expired', 'reason', 'Trop d''essais.');
    end if;
    return jsonb_build_object('status', 'running', 'error', 'Code incorrect.', 'attempts_left', 5 - v_attempts);
  end if;

  update public.proof_sessions set status = 'completed', ended_at = now() where id = s.id;
  if s.principle_id is not null then
    v_result := public._create_validation(s.user_id, s.principle_id, s.day, 'reveil', 'forte', s.id, null, null);
  else
    perform public._evaluate_assignment(s.challenge_assignment_id, false);
    perform public._after_change(s.user_id);
  end if;
  return jsonb_build_object('status', 'completed', 'validation', v_result);
end;
$$;

-- ===========================================================================
-- Jokers : une journée neutre (ni points ni pénalité), une série préservée
-- ===========================================================================
create function public.use_joker() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_today date := public.paris_today();
  e public.enrollments := public._open_enrollment(v_user);
  v_max int;
begin
  if e.id is null or e.status <> 'active' or v_today < e.start_date or v_today > e.end_date then
    raise exception 'Aucun arc en cours aujourd''hui.';
  end if;
  if public._plan(v_user) is null then
    raise exception 'Ton abonnement est inactif.';
  end if;
  v_max := (public._limits(public._plan(v_user)) ->> 'jokers')::int;
  if e.jokers_used >= v_max then
    raise exception 'Plus de joker pour cet arc.';
  end if;
  insert into public.joker_days (enrollment_id, day) values (e.id, v_today) on conflict do nothing;
  if not found then
    raise exception 'Joker déjà posé aujourd''hui.';
  end if;
  update public.enrollments set jokers_used = jokers_used + 1 where id = e.id;
  return jsonb_build_object('jokers_left', v_max - e.jokers_used - 1);
end;
$$;

-- ===========================================================================
-- Portefeuille
-- ===========================================================================
-- Ajout par le serveur (service_role), après vérification et ré-encodage de la capture éventuelle.
create function public.add_wallet_entry(
  p_user uuid,
  p_amount_cents int,
  p_source text,
  p_label text,
  p_day date,
  p_proof_path text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := public.paris_today();
  v_label text := regexp_replace(btrim(coalesce(p_label, '')), '\s+', ' ', 'g');
  v_day date := coalesce(p_day, v_today);
  e public.enrollments := public._open_enrollment(p_user);
  v_status text;
  v_id uuid;
  v_points int := 0;
  v_audit boolean := false;
begin
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Profil introuvable.';
  end if;
  if not coalesce((public._limits(public._plan(p_user)) ->> 'wallet')::boolean, false) then
    raise exception 'Le portefeuille fait partie du plan Pro.';
  end if;
  if p_amount_cents is null or p_amount_cents < 1 or p_amount_cents > 100000000 then
    raise exception 'Montant invalide (de 0,01 € à 1 000 000 €).';
  end if;
  if p_source is null or p_source not in ('vente', 'client', 'freelance', 'contenu', 'autre') then
    raise exception 'Choisis la source.';
  end if;
  if length(v_label) < 2 or length(v_label) > 80 then
    raise exception 'Libellé : de 2 à 80 caractères.';
  end if;
  if v_day > v_today or v_day < v_today - 30 then
    raise exception 'Date : dans les 30 derniers jours.';
  end if;
  if p_proof_path is not null then
    perform public._check_proof_file(p_user, p_proof_path);
  end if;
  if e.id is not null and not (e.status = 'active' and v_day between e.start_date and e.end_date) then
    e := null;
  end if;

  v_status := case when p_proof_path is null then 'declared' else 'proven' end;
  insert into public.wallet_entries (user_id, enrollment_id, day, amount_cents, source, label, proof_path, status)
  values (p_user, e.id, v_day, p_amount_cents, p_source, v_label, p_proof_path, v_status)
  returning id into v_id;

  -- Revenu prouvé pendant l'arc : + 15, une fois par jour.
  if v_status = 'proven' and e.id is not null then
    if public._award(e.id, p_user, v_today, 15, 'wallet', public._ref('wallet:' || p_user || ':' || v_today)) then
      v_points := 15;
    end if;
    if random() < public._audit_rate() then
      insert into public.audits (wallet_entry_id, enrollment_id, user_id, due_at, penalty)
      values (v_id, e.id, p_user, now() + interval '24 hours', 30);
      update public.wallet_entries set status = 'audit_pending' where id = v_id;
      v_audit := true;
    end if;
  end if;

  perform public._after_change(p_user);
  return jsonb_build_object('id', v_id, 'status', case when v_audit then 'audit_pending' else v_status end,
    'points', v_points, 'audit', v_audit);
end;
$$;

-- Seules les entrées non prouvées peuvent être retirées.
create function public.delete_wallet_entry(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
begin
  delete from public.wallet_entries where id = p_id and user_id = v_user and status = 'declared';
  if not found then
    raise exception 'Seul un revenu non prouvé peut être retiré.';
  end if;
  perform public._after_change(v_user);
end;
$$;

-- ===========================================================================
-- Quêtes de la semaine (blocs de 7 jours depuis le jour 1)
-- ===========================================================================
create function public._challenge_points(ch public.challenges, p_done boolean) returns int
language sql immutable set search_path = '' as $$
  select case
    when ch.kind = 'piege' then case when p_done then 150 else -150 end
    when p_done then 100 * ch.level
    else -50 * ch.level
  end;
$$;

-- Palier des quêtes selon le niveau du joueur.
create function public._tier(p_user uuid) returns int
language sql stable set search_path = '' as $$
  select case when coalesce(ps.level, 1) < 8 then 1 when ps.level < 16 then 2 else 3 end
  from (select 1) x left join public.player_stats ps on ps.user_id = p_user;
$$;

create function public._assignment_range(p_assignment uuid, out p_from date, out p_to date)
language sql stable set search_path = '' as $$
  select e.start_date + 7 * (a.week - 1), least(e.start_date + 7 * a.week - 1, e.end_date)
  from public.challenge_assignments a
  join public.enrollments e on e.id = a.enrollment_id
  where a.id = p_assignment;
$$;

-- Avancement d'une quête : {current, goal, met}.
create function public._assignment_progress(p_assignment uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  a public.challenge_assignments;
  ch public.challenges;
  v_from date;
  v_to date;
  v_rule jsonb;
  v_goal int;
  v_current int := 0;
  v_min int;
  v_before time;
  v_days date[];
  v_run int := 0;
  v_best int := 0;
  v_prev date;
  v_d date;
begin
  select * into a from public.challenge_assignments where id = p_assignment;
  select * into ch from public.challenges where id = a.challenge_id;
  select r.p_from, r.p_to into v_from, v_to from public._assignment_range(a.id) r;
  v_rule := ch.rule;
  v_goal := coalesce((v_rule ->> 'count')::int, 1);

  case v_rule ->> 'type'
    when 'sessions' then
      select count(*) into v_current from public.proof_sessions
      where enrollment_id = a.enrollment_id and kind = 'session' and status = 'completed'
        and day between v_from and v_to and minutes >= (v_rule ->> 'min_minutes')::int;
    when 'session_minutes' then
      v_goal := (v_rule ->> 'minutes')::int;
      select coalesce(sum(minutes), 0) into v_current from public.proof_sessions
      where enrollment_id = a.enrollment_id and kind = 'session' and status = 'completed'
        and day between v_from and v_to;
    when 'declaratif', 'photo' then
      select count(*) into v_current from public.challenge_proofs
      where assignment_id = a.id and kind = (v_rule ->> 'type') and status <> 'rejected';
    when 'links' then
      select count(distinct day) into v_current from public.challenge_proofs
      where assignment_id = a.id and kind = 'lien' and status <> 'rejected';
    when 'reps' then
      select coalesce(sum((data ->> 'count')::int), 0) into v_current from public.proof_sessions
      where enrollment_id = a.enrollment_id and kind = 'reps' and status = 'completed'
        and day between v_from and v_to and coalesce(data ->> 'exercise', 'pushup') = v_rule ->> 'exercise';
    when 'green_day' then
      select count(*) into v_current from public.day_status
      where enrollment_id = a.enrollment_id and status = 'green' and day between v_from and v_to
        and extract(isodow from day)::int = (v_rule ->> 'isodow')::int;
    when 'green_days' then
      select count(*) into v_current from public.day_status
      where enrollment_id = a.enrollment_id and status = 'green' and day between v_from and v_to;
    when 'wake' then
      select count(*) into v_current from public.proof_sessions
      where challenge_assignment_id = a.id and kind = 'reveil' and status = 'completed';
    when 'wakes' then
      select count(*) into v_current from public.proof_sessions
      where enrollment_id = a.enrollment_id and kind = 'reveil' and status = 'completed'
        and day between v_from and v_to
        and (ended_at at time zone 'Europe/Paris')::time <= (v_rule ->> 'before')::time;
    when 'wallet_days' then
      select count(distinct w.day) into v_current from public.wallet_entries w
      where w.enrollment_id = a.enrollment_id and w.status in ('proven', 'audit_pending') and w.day between v_from and v_to;
    when 'sessions_before' then
      v_before := (v_rule ->> 'before')::time;
      v_min := coalesce(
        (v_rule ->> 'min_minutes')::int,
        (select max((pr.target ->> 'minutes')::int) from public.principles pr
          where pr.enrollment_id = a.enrollment_id and pr.proof_type = 'session'),
        50);
      select coalesce(array_agg(distinct day order by day), '{}') into v_days from public.proof_sessions
      where enrollment_id = a.enrollment_id and kind = 'session' and status = 'completed'
        and day between v_from and v_to and minutes >= v_min
        and (ended_at at time zone 'Europe/Paris')::time <= v_before
        and (ended_at at time zone 'Europe/Paris')::date = day;
      if coalesce((v_rule ->> 'consecutive')::boolean, false) then
        foreach v_d in array v_days loop
          v_run := case when v_prev is not null and v_d = v_prev + 1 then v_run + 1 else 1 end;
          v_best := greatest(v_best, v_run);
          v_prev := v_d;
        end loop;
        v_current := v_best;
      else
        v_current := cardinality(v_days);
      end if;
    else
      v_current := 0;
  end case;

  return jsonb_build_object('current', v_current, 'goal', v_goal, 'met', v_current >= v_goal);
end;
$$;

create function public._evaluate_assignment(p_assignment uuid, p_final boolean) returns text
language plpgsql set search_path = '' as $$
declare
  a public.challenge_assignments;
  ch public.challenges;
  e public.enrollments;
  v_to date;
  v_met boolean;
begin
  select * into a from public.challenge_assignments where id = p_assignment for update;
  if a.id is null or a.status <> 'assigned' then
    return a.status;
  end if;
  select * into ch from public.challenges where id = a.challenge_id;
  select * into e from public.enrollments where id = a.enrollment_id;
  select r.p_to into v_to from public._assignment_range(a.id) r;
  v_met := (public._assignment_progress(a.id) ->> 'met')::boolean;

  if v_met then
    update public.challenge_assignments set status = 'done', evaluated_at = now() where id = a.id;
    perform public._award(e.id, e.user_id, least(public.paris_today(), v_to), public._challenge_points(ch, true),
      'challenge', a.id);
    return 'done';
  elsif p_final then
    update public.challenge_assignments set status = 'failed', evaluated_at = now() where id = a.id;
    perform public._award(e.id, e.user_id, v_to, public._challenge_points(ch, false), 'challenge', a.id);
    return 'failed';
  end if;
  return 'assigned';
end;
$$;

-- Attribue la quête de la semaine en cours si elle manque. Un piège toutes les 4 semaines.
create function public._ensure_assignment(p_enrollment uuid) returns void
language plpgsql set search_path = '' as $$
declare
  e public.enrollments;
  v_today date := public.paris_today();
  v_week int;
  v_tier int;
  v_challenge uuid;
  v_kind text;
begin
  select * into e from public.enrollments where id = p_enrollment;
  if e.status <> 'active' or v_today < e.start_date or v_today > e.end_date then
    return;
  end if;
  v_week := public._arc_week(e.start_date, v_today);
  if v_week > 13 or exists (select 1 from public.challenge_assignments where enrollment_id = e.id and week = v_week) then
    return;
  end if;
  v_kind := case when v_week % 4 = 0 then 'piege' else 'epreuve' end;
  v_tier := public._tier(e.user_id);

  select ch.id into v_challenge from public.challenges ch
  where ch.kind = v_kind
    and (v_kind = 'piege' or (ch.category = e.category and ch.level = v_tier))
    and ch.id not in (select challenge_id from public.challenge_assignments where enrollment_id = e.id)
  order by random()
  limit 1;
  -- Bibliothèque épuisée : on autorise une répétition.
  if v_challenge is null then
    select ch.id into v_challenge from public.challenges ch
    where ch.kind = v_kind and (v_kind = 'piege' or (ch.category = e.category and ch.level = v_tier))
    order by random()
    limit 1;
  end if;
  if v_challenge is not null then
    insert into public.challenge_assignments (enrollment_id, challenge_id, week)
    values (e.id, v_challenge, v_week)
    on conflict (enrollment_id, week) do nothing;
  end if;
end;
$$;

create function public._current_assignment(p_user uuid, p_assignment uuid)
returns public.challenge_assignments
language plpgsql stable set search_path = '' as $$
declare
  a public.challenge_assignments;
  e public.enrollments;
begin
  select * into a from public.challenge_assignments where id = p_assignment;
  if a.id is not null then
    select * into e from public.enrollments where id = a.enrollment_id;
  end if;
  if a.id is null or e.user_id <> p_user then
    raise exception 'Quête introuvable.';
  end if;
  if e.status <> 'active' then
    raise exception 'Ton arc n''est pas en cours.';
  end if;
  if public._plan(p_user) is null then
    raise exception 'Ton abonnement est inactif.';
  end if;
  if public._arc_week(e.start_date, public.paris_today()) <> a.week or public.paris_today() > e.end_date then
    raise exception 'Cette quête n''est plus en cours.';
  end if;
  if a.status <> 'assigned' then
    raise exception 'Quête déjà jugée.';
  end if;
  return a;
end;
$$;

create function public._add_challenge_proof(p_user uuid, p_assignment uuid, p_kind text, p_link text, p_photo text)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  a public.challenge_assignments := public._current_assignment(p_user, p_assignment);
  ch public.challenges;
  v_proof uuid;
  v_audit boolean := false;
  v_status text;
begin
  select * into ch from public.challenges where id = a.challenge_id;
  if ch.proof_type is distinct from p_kind then
    raise exception 'Cette quête demande une autre preuve.';
  end if;
  if p_kind in ('declaratif', 'photo') and exists (
    select 1 from public.challenge_proofs where assignment_id = a.id and kind = p_kind and status <> 'rejected'
  ) then
    raise exception 'Quête déjà prouvée.';
  end if;
  insert into public.challenge_proofs (assignment_id, day, kind, link_url, photo_path)
  values (a.id, public.paris_today(), p_kind, p_link, p_photo)
  returning id into v_proof;
  if ch.forced_audit or (p_kind = 'declaratif' and random() < public._audit_rate()) then
    insert into public.audits (challenge_proof_id, enrollment_id, user_id, due_at, penalty)
    values (v_proof, a.enrollment_id, p_user, now() + interval '24 hours', 0);
    update public.challenge_proofs set status = 'audit_pending' where id = v_proof;
    v_audit := true;
  end if;
  v_status := public._evaluate_assignment(a.id, false);
  perform public._after_change(p_user);
  return jsonb_build_object('status', v_status, 'audit', v_audit);
end;
$$;

create function public.validate_challenge_declaratif(p_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return public._add_challenge_proof(public._require_user(), p_assignment_id, 'declaratif', null, null);
end;
$$;

create function public.validate_challenge_link(p_assignment_id uuid, p_url text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  a public.challenge_assignments := public._current_assignment(v_user, p_assignment_id);
  ch public.challenges;
  v_link text;
begin
  select * into ch from public.challenges where id = a.challenge_id;
  v_link := public._normalize_link(p_url, array(select jsonb_array_elements_text(coalesce(ch.rule -> 'domains', '[]'))));
  if exists (select 1 from public.validations where link_url = v_link)
    or exists (select 1 from public.challenge_proofs where link_url = v_link) then
    raise exception 'Ce lien a déjà servi.';
  end if;
  if exists (select 1 from public.challenge_proofs where assignment_id = a.id and day = public.paris_today()) then
    raise exception 'Un seul lien par jour compte pour cette quête.';
  end if;
  return public._add_challenge_proof(v_user, a.id, 'lien', v_link, null);
end;
$$;

create function public.validate_challenge_photo(p_user uuid, p_assignment_id uuid, p_path text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public._check_proof_file(p_user, p_path);
  return public._add_challenge_proof(p_user, p_assignment_id, 'photo', null, p_path);
end;
$$;

create function public.start_challenge_session(p_assignment_id uuid, p_minutes int default null) returns jsonb
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
    v_code := public._six_digits();
    v_data := jsonb_build_object('code_hash', encode(sha256(convert_to(v_code, 'UTF8')), 'hex'), 'attempts', 0);
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
    'started_at', s.started_at, 'server_now', now(), 'code', v_code, 'target', ch.rule
  );
end;
$$;

-- ===========================================================================
-- Contrôles
-- ===========================================================================
create function public.submit_audit_photo(p_user uuid, p_audit_id uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  au public.audits;
begin
  select * into au from public.audits where id = p_audit_id for update;
  if au.id is null or au.user_id <> p_user then
    raise exception 'Contrôle introuvable.';
  end if;
  if au.status <> 'open' then
    raise exception 'Ce contrôle n''attend plus de preuve.';
  end if;
  if now() > au.due_at then
    raise exception 'Trop tard : le délai de 24 h est passé.';
  end if;
  perform public._check_proof_file(p_user, p_path);
  update public.audits set status = 'submitted', photo_path = p_path, submitted_at = now() where id = au.id;
end;
$$;

create function public._fail_audit(p_audit uuid, p_reviewer uuid) returns void
language plpgsql set search_path = '' as $$
declare
  au public.audits;
  v public.validations;
  cp public.challenge_proofs;
  a public.challenge_assignments;
  ch public.challenges;
begin
  update public.audits
  set status = 'failed', reviewed_by = p_reviewer, reviewed_at = now()
  where id = p_audit and status in ('open', 'submitted')
  returning * into au;
  if au.id is null then
    return;
  end if;
  update public.profiles set refused_proofs = refused_proofs + 1 where id = au.user_id;

  if au.validation_id is not null then
    update public.validations set status = 'rejected' where id = au.validation_id returning * into v;
    -- Contrôle refusé ou non envoyé : − 3 × valeur.
    perform public._award(au.enrollment_id, au.user_id, v.day, -au.penalty, 'audit_failed', au.id);
    update public.day_status set status = 'red'
    where enrollment_id = au.enrollment_id and day = v.day and status = 'green';
  elsif au.wallet_entry_id is not null then
    update public.wallet_entries set status = 'rejected' where id = au.wallet_entry_id;
    perform public._award(au.enrollment_id, au.user_id, public.paris_today(), -au.penalty, 'wallet_audit_failed', au.id);
  else
    update public.challenge_proofs set status = 'rejected' where id = au.challenge_proof_id returning * into cp;
    select * into a from public.challenge_assignments where id = cp.assignment_id for update;
    select * into ch from public.challenges where id = a.challenge_id;
    if a.status = 'done' then
      update public.challenge_assignments set status = 'failed', evaluated_at = now() where id = a.id;
      -- Annule le gain et applique l'échec.
      perform public._award(au.enrollment_id, au.user_id, public.paris_today(),
        -(public._challenge_points(ch, true) - public._challenge_points(ch, false)), 'challenge_audit_failed', au.id);
    end if;
  end if;
  perform public._after_change(au.user_id);
end;
$$;

create function public._pass_audit(p_audit uuid, p_reviewer uuid) returns void
language plpgsql set search_path = '' as $$
declare
  au public.audits;
begin
  update public.audits
  set status = 'passed', reviewed_by = p_reviewer, reviewed_at = now()
  where id = p_audit and status in ('open', 'submitted')
  returning * into au;
  if au.id is null then
    return;
  end if;
  if au.validation_id is not null then
    update public.validations set status = 'valid' where id = au.validation_id;
  elsif au.wallet_entry_id is not null then
    update public.wallet_entries set status = 'proven' where id = au.wallet_entry_id;
  else
    update public.challenge_proofs set status = 'valid' where id = au.challenge_proof_id;
  end if;
  perform public._after_change(au.user_id);
end;
$$;

-- ===========================================================================
-- Stats de joueur, succès
-- ===========================================================================
create function public._level_for(p_xp int) returns int
language sql immutable set search_path = '' as $$
  select floor(sqrt(greatest(p_xp, 0) / 50.0))::int + 1;
$$;

create function public._refresh_stats(p_user uuid) returns void
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
  v_closed int;
  v_good int;
  v_disc int;
  v_streak int := 0;
  v_best int;
  d record;
begin
  select coalesce(sum(delta) filter (where delta > 0), 0) into v_xp from public.points_ledger where user_id = p_user;

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

create function public._unlock(p_user uuid, p_code text, p_enrollment uuid) returns boolean
language plpgsql set search_path = '' as $$
declare
  a public.achievements;
begin
  select * into a from public.achievements where code = p_code;
  if a.id is null then
    return false;
  end if;
  insert into public.user_achievements (user_id, achievement_id, enrollment_id)
  values (p_user, a.id, p_enrollment)
  on conflict do nothing;
  if not found then
    return false;
  end if;
  if p_enrollment is not null then
    perform public._award(p_enrollment, p_user, public.paris_today(), a.points, 'achievement',
      public._ref('achievement:' || a.id || ':' || p_user));
  end if;
  return true;
end;
$$;

-- Débloque ce qui est mérité. Renvoie le nombre de nouveaux succès.
create function public._check_achievements(p_user uuid) returns int
language plpgsql set search_path = '' as $$
declare
  e public.enrollments := public._current_enrollment(p_user);
  ps public.player_stats;
  v_new int := 0;
  v_closed int;
  v_e uuid;
begin
  select * into ps from public.player_stats where user_id = p_user;
  v_e := case when e.status in ('active', 'completed', 'failed', 'abandoned') then e.id end;

  if exists (select 1 from public.day_status ds join public.enrollments en on en.id = ds.enrollment_id
    where en.user_id = p_user and ds.status = 'green') then
    v_new := v_new + public._unlock(p_user, 'premier_vert', v_e)::int;
  end if;

  if v_e is not null then
    if public._longest_run(array(select day from public.day_status where enrollment_id = e.id and status = 'green')) >= 7 then
      v_new := v_new + public._unlock(p_user, 'premiere_semaine_parfaite', v_e)::int;
    end if;
    if public._longest_run(array(select day from public.day_status where enrollment_id = e.id and status = 'green')) >= 30 then
      v_new := v_new + public._unlock(p_user, 'serie_30', v_e)::int;
    end if;
    select count(*) into v_closed from public.day_status where enrollment_id = e.id;
    if v_closed >= 30 and not exists (
      select 1 from public.misses m
      where m.enrollment_id = e.id and m.streak >= 2
        and m.day > (select max(day) - 30 from public.day_status where enrollment_id = e.id)
    ) then
      v_new := v_new + public._unlock(p_user, 'jamais_deux_fois', v_e)::int;
    end if;
    if public._longest_run(array(
      select ds.day from public.day_status ds
      where ds.enrollment_id = e.id and ds.status = 'green'
        and not exists (select 1 from public.validations v where v.enrollment_id = e.id and v.day = ds.day and v.strength = 'faible')
    )) >= 14 then
      v_new := v_new + public._unlock(p_user, 'sans_filet', v_e)::int;
    end if;
    if exists (select 1 from public.day_status where enrollment_id = e.id and day = e.start_date + 44)
      and not exists (select 1 from public.day_status where enrollment_id = e.id and status = 'white') then
      v_new := v_new + public._unlock(p_user, 'mi_parcours', v_e)::int;
    end if;
  end if;

  if (
    select count(*) from public.validations v
    join public.proof_sessions s on s.id = v.proof_session_id
    where s.user_id = p_user and v.proof_type = 'reveil' and v.status <> 'rejected'
      and (s.ended_at at time zone 'Europe/Paris')::time < '06:30'
  ) >= 10 then
    v_new := v_new + public._unlock(p_user, 'aube', v_e)::int;
  end if;

  if ps.focus_minutes >= 600 then v_new := v_new + public._unlock(p_user, 'travail_profond_1', v_e)::int; end if;
  if ps.focus_minutes >= 3000 then v_new := v_new + public._unlock(p_user, 'travail_profond_2', v_e)::int; end if;
  if ps.focus_minutes >= 6000 then v_new := v_new + public._unlock(p_user, 'travail_profond_3', v_e)::int; end if;
  if ps.reps >= 1000 then v_new := v_new + public._unlock(p_user, 'mille', v_e)::int; end if;
  if (select count(*) from public.audits where user_id = p_user and status = 'passed') >= 5 then
    v_new := v_new + public._unlock(p_user, 'controle', v_e)::int;
  end if;
  if exists (select 1 from public.enrollments where user_id = p_user and status = 'completed') then
    v_new := v_new + public._unlock(p_user, 'arc_tenu', v_e)::int;
  end if;
  if ps.wallet_proven_cents >= 1 then v_new := v_new + public._unlock(p_user, 'premier_euro', v_e)::int; end if;
  if ps.wallet_proven_cents >= 10000 then v_new := v_new + public._unlock(p_user, 'cent_euros', v_e)::int; end if;
  if ps.wallet_proven_cents >= 100000 then v_new := v_new + public._unlock(p_user, 'mille_euros', v_e)::int; end if;
  if ps.wallet_proven_cents >= 1000000 then v_new := v_new + public._unlock(p_user, 'dix_mille_euros', v_e)::int; end if;
  if ps.level >= 10 then v_new := v_new + public._unlock(p_user, 'niveau_10', v_e)::int; end if;
  if ps.level >= 20 then v_new := v_new + public._unlock(p_user, 'niveau_20', v_e)::int; end if;
  if ps.ovr >= 80 then v_new := v_new + public._unlock(p_user, 'ovr_80', v_e)::int; end if;
  if exists (select 1 from public.squad_members where user_id = p_user) then
    v_new := v_new + public._unlock(p_user, 'escouade', v_e)::int;
  end if;
  return v_new;
end;
$$;

-- Après tout changement : stats, succès, puis stats à nouveau si un succès a rapporté des points.
create function public._after_change(p_user uuid) returns void
language plpgsql set search_path = '' as $$
begin
  perform public._refresh_stats(p_user);
  if public._check_achievements(p_user) > 0 then
    perform public._refresh_stats(p_user);
  end if;
end;
$$;

-- ===========================================================================
-- Fin d'arc : tenu (verts + jokers ≥ 75, jamais plus de 3 jours non verts d'affilée hors jokers) ou raté.
-- ===========================================================================
create function public._finish_arc(p_enrollment uuid) returns text
language plpgsql set search_path = '' as $$
declare
  e public.enrollments;
  v_good int;
  v_worst int;
begin
  select * into e from public.enrollments where id = p_enrollment for update;
  if e.id is null or e.status <> 'active' then
    return e.status;
  end if;
  select count(*) into v_good from public.day_status where enrollment_id = e.id and status in ('green', 'joker');
  select coalesce(max(n), 0) into v_worst from (
    select count(*) as n from (
      select ds.day, ds.day - (row_number() over (order by ds.day))::int as grp
      from public.day_status ds
      where ds.enrollment_id = e.id and ds.status in ('red', 'white')
    ) t group by grp
  ) runs;

  if v_good >= 75 and v_worst <= 3 then
    update public.enrollments set status = 'completed', closed_at = now() where id = e.id;
    perform public._award(e.id, e.user_id, e.end_date, 500, 'arc_completed', e.id);
    return 'completed';
  end if;
  update public.enrollments set status = 'failed', closed_at = now() where id = e.id;
  return 'failed';
end;
$$;

-- ===========================================================================
-- Clôture d'une journée : ratés, « jamais deux fois », jours blancs, jokers, semaine parfaite, quêtes, abandon
-- ===========================================================================
create function public.close_day(p_enrollment uuid, p_day date) returns text
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
      -- − valeur ; deux jours d'affilée − 2 × ; trois et plus − 3 × ; jour blanc au moins − 2 ×.
      v_mult := greatest(case when v_white then 2 else 1 end, least(v_streak, 3));
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
