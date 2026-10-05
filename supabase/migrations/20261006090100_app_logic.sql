-- Logique du jeu, côté serveur uniquement (§6, §9, §14).
-- Les fonctions publiques sont SECURITY DEFINER et vérifient tout : propriétaire, statut, jour, heure du serveur.
-- Les fonctions préfixées par _ sont internes (aucun droit d'exécution pour les clients).
-- Valeurs de points : les mêmes que lib/rules.ts (à garder synchronisées).

alter table public.enrollments add column utm_source text check (length(utm_source) <= 100);
alter table public.enrollments add column utm_campaign text check (length(utm_campaign) <= 100);

-- ===========================================================================
-- Outils
-- ===========================================================================
create function public.paris_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Paris')::date;
$$;

create function public.paris_now() returns timestamp
language sql stable set search_path = '' as $$
  select now() at time zone 'Europe/Paris';
$$;

create function public._week_monday(p_day date) returns date
language sql immutable set search_path = '' as $$
  select p_day - (extract(isodow from p_day)::int - 1);
$$;

-- Semaine de l'arc (1 = semaine du départ, du lundi au dimanche).
create function public._arc_week(p_start date, p_day date) returns int
language sql immutable set search_path = '' as $$
  select ((public._week_monday(p_day) - public._week_monday(p_start)) / 7) + 1;
$$;

-- 07:00 → « 7 h », 06:30 → « 6 h 30 ».
create function public._time_fr(p_time time) returns text
language sql immutable set search_path = '' as $$
  select extract(hour from p_time)::int || ' h'
    || case when extract(minute from p_time)::int > 0
         then ' ' || lpad(extract(minute from p_time)::int::text, 2, '0') else '' end;
$$;

-- Identifiant déterministe d'une cause de points (pour unique(reason, ref_id)).
create function public._ref(p_text text) returns uuid
language sql immutable set search_path = '' as $$
  select md5(p_text)::uuid;
$$;

create function public._require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Connecte-toi pour continuer.';
  end if;
  return v_user;
end;
$$;

create function public._audit_rate() returns numeric
language sql stable set search_path = '' as $$
  select coalesce((select (s.value #>> '{}')::numeric from public.settings s where s.key = 'audit_rate'), 0.10);
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

-- Inscription « courante » : l'active d'abord, puis celle en attente de paiement, puis la plus récente.
create function public._enrollment_for_user(p_user uuid) returns public.enrollments
language sql stable set search_path = '' as $$
  select e.*
  from public.enrollments e
  join public.cohorts c on c.id = e.cohort_id
  where e.user_id = p_user
  order by case e.status when 'active' then 0 when 'pending_payment' then 1 else 2 end, c.start_date desc
  limit 1;
$$;

create function public._is_scheduled(p_days int[], p_day date) returns boolean
language sql immutable set search_path = '' as $$
  select extract(isodow from p_day)::int = any(p_days);
$$;

-- Normalise un lien et vérifie son domaine. Le serveur ne télécharge jamais l'URL (pas de SSRF).
create function public._normalize_link(p_url text, p_domains text[]) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_url text := btrim(coalesce(p_url, ''));
  v_host text;
  v_rest text;
begin
  if length(v_url) > 500 or v_url !~* '^https://[^\s/?#]+' or v_url ~ '\s' then
    raise exception 'Lien invalide : il doit commencer par https://.';
  end if;
  if v_url ~* '^https://[^/?#]*@' then
    raise exception 'Lien invalide.';
  end if;
  v_host := lower(substring(v_url from '(?i)^https://([^/?#:]+)'));
  v_rest := coalesce(substring(v_url from '(?i)^https://[^/?#]+([^#]*)'), '');
  v_rest := regexp_replace(v_rest, '/+$', '');
  if p_domains is not null and cardinality(p_domains) > 0 and not exists (
    select 1 from unnest(p_domains) d
    where regexp_replace(v_host, '^www\.', '') = d or v_host like '%.' || d
  ) then
    raise exception 'Ce lien doit venir de : %.', array_to_string(p_domains, ', ');
  end if;
  if v_rest = '' or v_rest = '/' then
    raise exception 'Colle le lien de ta publication, pas celui du site.';
  end if;
  return 'https://' || v_host || v_rest;
end;
$$;

-- Code à 6 chiffres tiré d'un générateur cryptographique (gen_random_uuid utilise pg_strong_random).
create function public._six_digits() returns text
language sql volatile set search_path = '' as $$
  select lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
$$;

create function public._nonce() returns text
language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

-- ===========================================================================
-- Onboarding : profil, inscription, principes imposés
-- ===========================================================================
create function public._generate_principles(p_enrollment uuid) returns void
language plpgsql set search_path = '' as $$
declare
  e public.enrollments;
  t public.principle_templates;
  v_codes text[];
  v_candidates text[] := '{}';
  v_code text;
  v_moment text;
  v_pos int := 0;
  v_target jsonb;
  v_if text;
begin
  select * into e from public.enrollments where id = p_enrollment;
  delete from public.principles where enrollment_id = p_enrollment and source = 'template';

  -- Socle : réveil, sport adapté à la réponse sur les pompes, travail profond.
  v_codes := array[
    'reveil',
    case e.pushups when 'oui' then 'pompes_20' when 'quelques' then 'pompes_10' else 'squats_20' end,
    'bureau_50'
  ];

  -- Puis les moments où l'utilisateur décroche, dans l'ordre où il les a choisis.
  foreach v_moment in array e.weak_moments loop
    v_candidates := v_candidates || (case v_moment
      when 'soir' then 'telephone_22h30'
      when 'fatigue' then 'fatigue_25'
      when 'weekend' then 'weekend_90'
      when 'commencer' then 'petite_action'
      when 'personne' then case e.category when 'business' then 'prospection' else 'td' end
      else null end);
  end loop;

  -- Puis la catégorie, puis des principes généraux.
  v_candidates := v_candidates || (case e.category
    when 'etudes' then array['td', 'petite_action']
    when 'business' then array['prospection', 'publication']
    else array['td', 'prospection'] end);
  v_candidates := v_candidates || array['petite_action', 'fatigue_25', 'telephone_22h30', 'salle'];

  foreach v_code in array v_candidates loop
    exit when cardinality(v_codes) >= 5;
    if v_code is not null and not (v_code = any(v_codes)) then
      v_codes := v_codes || v_code;
    end if;
  end loop;

  foreach v_code in array v_codes loop
    select * into t from public.principle_templates where code = v_code;
    v_pos := v_pos + 1;
    v_target := t.target;
    v_if := t.if_text;
    if v_code = 'reveil' then
      v_target := jsonb_build_object('before', to_char(e.wake_time, 'HH24:MI'));
      v_if := 'S''il est ' || public._time_fr(e.wake_time);
    end if;
    insert into public.principles (enrollment_id, position, if_text, then_text, proof_type, difficulty,
      max_difficulty, days, target, source, template_code)
    values (p_enrollment, v_pos, v_if, t.then_text, t.proof_type,
      -- Niveau 1 : difficulté plafonnée à 2. La difficulté 3 se débloque au niveau 2.
      least(t.difficulty, e.level + 1), t.difficulty, t.days, v_target, 'template', v_code);
  end loop;
end;
$$;

create function public.create_enrollment(
  p_pseudo text,
  p_birth_year int,
  p_is_public boolean,
  p_adult boolean,
  p_category text,
  p_goal_title text,
  p_goal_public boolean,
  p_weak_moments text[],
  p_wake_time text,
  p_pushups text,
  p_cohort_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_today date := public.paris_today();
  v_pseudo text := lower(btrim(coalesce(p_pseudo, '')));
  v_goal text := regexp_replace(btrim(coalesce(p_goal_title, '')), '\s+', ' ', 'g');
  v_moments text[] := coalesce(p_weak_moments, '{}');
  v_cohort public.cohorts;
  v_enrollment public.enrollments;
  v_wake time;
begin
  if not exists (select 1 from public.profiles where id = v_user) then
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
    insert into public.profiles (id, pseudo, birth_year, is_public, referral_code)
    values (v_user, v_pseudo, p_birth_year, coalesce(p_is_public, false), upper(replace(v_pseudo, '_', '-')));
  else
    update public.profiles set is_public = coalesce(p_is_public, is_public) where id = v_user;
  end if;

  if p_category is null or p_category not in ('etudes', 'business', 'mixte') then
    raise exception 'Choisis une catégorie.';
  end if;
  if length(v_goal) < 3 or length(v_goal) > 120 then
    raise exception 'Ton objectif tient en une phrase, de 3 à 120 caractères.';
  end if;
  if p_pushups is null or p_pushups not in ('oui', 'quelques', 'non') then
    raise exception 'Réponds à la question sur les pompes.';
  end if;
  if coalesce(p_wake_time, '') !~ '^([01][0-9]|2[0-3]):(00|30)$' then
    raise exception 'Heure de lever invalide.';
  end if;
  v_wake := p_wake_time::time;
  if v_wake < '04:00' or v_wake > '10:00' then
    raise exception 'Choisis une heure de lever entre 4 h et 10 h.';
  end if;
  if cardinality(v_moments) > 5 or exists (
    select 1 from unnest(v_moments) m where m not in ('soir', 'weekend', 'fatigue', 'commencer', 'personne')
  ) then
    raise exception 'Réponse invalide sur les moments où tu décroches.';
  end if;

  if p_cohort_id is not null then
    select * into v_cohort from public.cohorts where id = p_cohort_id;
  else
    select * into v_cohort from public.cohorts c
    where c.enroll_open and not c.is_test and v_today <= c.start_date + 6
    order by c.start_date
    limit 1;
  end if;
  -- On peut rejoindre un arc jusqu'à 6 jours après son départ.
  if v_cohort.id is null or not v_cohort.enroll_open or v_today > v_cohort.start_date + 6 then
    raise exception 'Aucun arc n''est ouvert aux inscriptions pour le moment.';
  end if;

  if exists (
    select 1 from public.enrollments e join public.cohorts c on c.id = e.cohort_id
    where e.user_id = v_user and e.status = 'active' and c.end_date >= v_today and e.cohort_id <> v_cohort.id
  ) then
    raise exception 'Tu as déjà un arc en cours.';
  end if;

  select * into v_enrollment from public.enrollments where user_id = v_user and cohort_id = v_cohort.id;
  if v_enrollment.id is not null and v_enrollment.status <> 'pending_payment' then
    raise exception 'Tu es déjà inscrit à cet arc.';
  end if;

  if v_enrollment.id is not null then
    update public.enrollments
    set category = p_category, goal_title = v_goal, goal_public = coalesce(p_goal_public, false),
        weak_moments = v_moments, wake_time = v_wake, pushups = p_pushups
    where id = v_enrollment.id
    returning * into v_enrollment;
  else
    insert into public.enrollments (user_id, cohort_id, category, goal_title, goal_public, weak_moments, wake_time, pushups)
    values (v_user, v_cohort.id, p_category, v_goal, coalesce(p_goal_public, false), v_moments, v_wake, p_pushups)
    returning * into v_enrollment;
  end if;

  perform public._generate_principles(v_enrollment.id);
  return v_enrollment.id;
end;
$$;

-- Un seul principe personnel : difficulté 1, preuve déclarative, modifiable jusqu'au départ.
create function public.set_custom_principle(p_if text, p_then text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._enrollment_for_user(v_user);
  c public.cohorts;
  v_if text := regexp_replace(btrim(coalesce(p_if, '')), '\s+', ' ', 'g');
  v_then text := regexp_replace(btrim(coalesce(p_then, '')), '\s+', ' ', 'g');
begin
  if e.id is null or e.status not in ('pending_payment', 'active') then
    raise exception 'Aucune inscription en cours.';
  end if;
  select * into c from public.cohorts where id = e.cohort_id;
  if e.status = 'active' and public.paris_today() >= greatest(c.start_date, e.started_on) then
    raise exception 'Les principes ne se modifient plus pendant l''arc.';
  end if;
  v_if := regexp_replace(v_if, '^(si|s'')\s*', '', 'i');
  v_then := regexp_replace(v_then, '^alors\s*', '', 'i');
  if length(v_if) < 2 or length(v_if) > 80 or length(v_then) < 2 or length(v_then) > 120 then
    raise exception 'Ton principe : « si » et « alors » de 2 à 80 caractères chacun.';
  end if;
  delete from public.principles where enrollment_id = e.id and source = 'custom';
  insert into public.principles (enrollment_id, position, if_text, then_text, proof_type, difficulty,
    max_difficulty, days, target, source)
  values (e.id, 6, 'Si ' || v_if, 'alors ' || rtrim(v_then, '.') || '.', 'declaratif', 1, 1,
    '{1,2,3,4,5,6,7}', '{}', 'custom');
end;
$$;

create function public.remove_custom_principle() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._enrollment_for_user(v_user);
  c public.cohorts;
begin
  if e.id is null or e.status not in ('pending_payment', 'active') then
    raise exception 'Aucune inscription en cours.';
  end if;
  select * into c from public.cohorts where id = e.cohort_id;
  if e.status = 'active' and public.paris_today() >= greatest(c.start_date, e.started_on) then
    raise exception 'Les principes ne se modifient plus pendant l''arc.';
  end if;
  delete from public.principles where enrollment_id = e.id and source = 'custom';
end;
$$;

-- ===========================================================================
-- Paiement : activation, prévente, mise
-- ===========================================================================
create function public._activate_enrollment(p_enrollment uuid, p_amount int, p_session text, p_presale uuid)
returns boolean
language plpgsql set search_path = '' as $$
begin
  update public.enrollments e
  set status = 'active',
      paid_at = now(),
      amount_paid_cents = p_amount,
      stripe_checkout_session_id = coalesce(p_session, e.stripe_checkout_session_id),
      presale_id = coalesce(p_presale, e.presale_id),
      started_on = greatest(c.start_date, public.paris_today())
  from public.cohorts c
  where e.id = p_enrollment and c.id = e.cohort_id and e.status = 'pending_payment';
  return found;
end;
$$;

-- Rattache une prévente payée avec le même email : l'inscription devient active sans second paiement.
create function public.claim_presale() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_email text := lower((select u.email from auth.users u where u.id = v_user));
  e public.enrollments;
  v_presale public.presales;
begin
  select * into e from public.enrollments
  where user_id = v_user and status = 'pending_payment'
  order by created_at desc limit 1;
  if e.id is null or v_email is null then
    return false;
  end if;
  select * into v_presale from public.presales
  where email = v_email and cohort_id = e.cohort_id and claimed_by is null and refunded_at is null
  order by paid_at
  limit 1
  for update;
  if v_presale.id is null then
    return false;
  end if;
  update public.presales set claimed_by = v_user, claimed_at = now() where id = v_presale.id;
  update public.enrollments
  set utm_source = v_presale.utm_source, utm_campaign = v_presale.utm_campaign
  where id = e.id;
  return public._activate_enrollment(e.id, v_presale.amount_paid_cents, null, v_presale.id);
end;
$$;

-- Webhook Stripe (service_role) : pass payé. Idempotent.
create function public.activate_paid_enrollment(
  p_enrollment uuid,
  p_session_id text,
  p_amount int,
  p_promotion_code_id text,
  p_utm_source text,
  p_utm_campaign text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.enrollments;
  v_activated boolean;
  v_referrer uuid;
begin
  select * into e from public.enrollments where id = p_enrollment for update;
  if e.id is null then
    raise exception 'Inscription introuvable.';
  end if;
  update public.enrollments
  set utm_source = coalesce(utm_source, left(p_utm_source, 100)),
      utm_campaign = coalesce(utm_campaign, left(p_utm_campaign, 100))
  where id = e.id;
  v_activated := public._activate_enrollment(e.id, p_amount, p_session_id, null);

  if p_promotion_code_id is not null then
    select p.id into v_referrer from public.profiles p where p.stripe_promotion_code_id = p_promotion_code_id;
    if v_referrer is not null and v_referrer <> e.user_id then
      insert into public.referrals (referrer_id, enrollment_id, stripe_checkout_session_id)
      values (v_referrer, e.id, p_session_id)
      on conflict (enrollment_id) do nothing;
    end if;
  end if;

  return jsonb_build_object('activated', v_activated, 'user_id', e.user_id, 'cohort_id', e.cohort_id);
end;
$$;

create function public.record_stake(p_enrollment uuid, p_payment_intent text, p_amount int) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.enrollments
  set stake_status = 'held', stake_cents = p_amount, stake_payment_intent_id = p_payment_intent
  where id = p_enrollment and stake_status = 'none' and status in ('pending_payment', 'active');
  return found;
end;
$$;

create function public.set_referral_promo(p_user uuid, p_promotion_code_id text) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set stripe_promotion_code_id = p_promotion_code_id
  where id = p_user and stripe_promotion_code_id is null;
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
  c public.cohorts;
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
    raise exception 'Ton arc n''est pas actif.';
  end if;
  select * into c from public.cohorts where id = e.cohort_id;
  if p_day < greatest(c.start_date, e.started_on) or p_day > c.end_date then
    raise exception 'Ce jour ne fait pas partie de ton arc.';
  end if;
  -- Aucune validation rétroactive. Seule exception : une session commencée avant minuit.
  if p_day <> v_today and not (p_session is not null and p_day = v_today - 1) then
    raise exception 'Trop tard : un principe se valide le jour même, avant minuit.';
  end if;
  if exists (select 1 from public.day_status where enrollment_id = e.id and day = p_day) then
    raise exception 'Trop tard : cette journée est close.';
  end if;
  if not public._is_scheduled(p.days, p_day) then
    raise exception 'Ce principe n''est pas prévu aujourd''hui.';
  end if;
  if exists (select 1 from public.validations where principle_id = p.id and day = p_day) then
    raise exception 'Déjà validé aujourd''hui.';
  end if;

  v_value := 10 * p.difficulty;
  -- Preuve forte : 100 % des points. Preuve faible : 50 %.
  v_points := case when p_strength = 'forte' then v_value else round(v_value * 0.5)::int end;

  insert into public.validations (enrollment_id, principle_id, day, proof_type, strength, points,
    proof_session_id, photo_path, link_url)
  values (e.id, p.id, p_day, p_proof_type, p_strength, v_points, p_session, p_photo, p_link)
  returning id into v_id;

  perform public._award(e.id, p_user, p_day, v_points, 'validation', v_id);

  -- Contrôle aléatoire sur les preuves faibles.
  if p_strength = 'faible' and random() < public._audit_rate() then
    insert into public.audits (validation_id, enrollment_id, user_id, due_at, penalty)
    values (v_id, e.id, p_user, now() + interval '24 hours', 3 * v_value);
    update public.validations set status = 'audit_pending' where id = v_id;
    v_audit := true;
  end if;

  perform public._check_achievements(e.id);
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
  if p.target ? 'after' and public.paris_now()::time < (p.target ->> 'after')::time then
    raise exception 'Ce principe se prouve à partir de %.', public._time_fr((p.target ->> 'after')::time);
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

-- Photo (service_role) : la photo a été vérifiée, ré-encodée et déposée par le serveur.
create function public.validate_photo(p_user uuid, p_principle_id uuid, p_path text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.principles := public._owned_principle(p_user, p_principle_id);
begin
  if p.proof_type <> 'photo' then
    raise exception 'Ce principe demande une autre preuve.';
  end if;
  if p.target ? 'after' and public.paris_now()::time < (p.target ->> 'after')::time then
    raise exception 'Ce principe se prouve à partir de %.', public._time_fr((p.target ->> 'after')::time);
  end if;
  if p_path !~ ('^' || p_user::text || '/[0-9a-f-]{36}\.jpg$') or not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'proofs' and o.name = p_path and o.created_at > now() - interval '15 minutes'
  ) then
    raise exception 'Photo introuvable.';
  end if;
  return public._create_validation(p_user, p.id, public.paris_today(), 'photo', 'faible', null, p_path, null);
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
  c public.cohorts;
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
  if e.status <> 'active' then
    raise exception 'Ton arc n''est pas actif.';
  end if;
  select * into c from public.cohorts where id = e.cohort_id;
  if v_today < greatest(c.start_date, e.started_on) or v_today > c.end_date then
    raise exception 'Ton arc n''a pas lieu aujourd''hui.';
  end if;
  if not public._is_scheduled(p.days, v_today) then
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
  end if;
  perform public._check_achievements(s.enrollment_id);
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
  end if;
  perform public._check_achievements(s.enrollment_id);
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
  end if;
  perform public._check_achievements(s.enrollment_id);
  return jsonb_build_object('status', 'completed', 'validation', v_result);
end;
$$;

-- ===========================================================================
-- Épreuves de la semaine
-- ===========================================================================
create function public._challenge_points(ch public.challenges, p_done boolean) returns int
language sql immutable set search_path = '' as $$
  select case
    when ch.kind = 'piege' then case when p_done then 150 else -150 end
    when p_done then 100 * ch.level
    else -50 * ch.level
  end;
$$;

-- Jours couverts par une semaine d'épreuve, bornés par l'arc et la date d'entrée.
create function public._assignment_range(p_assignment uuid, out p_from date, out p_to date)
language sql stable set search_path = '' as $$
  select greatest(public._week_monday(c.start_date) + 7 * (a.week - 1), c.start_date, e.started_on),
         least(public._week_monday(c.start_date) + 7 * (a.week - 1) + 6, c.end_date)
  from public.challenge_assignments a
  join public.enrollments e on e.id = a.enrollment_id
  join public.cohorts c on c.id = e.cohort_id
  where a.id = p_assignment;
$$;

-- Avancement d'une épreuve : {current, goal, met}.
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
    when 'wake' then
      select count(*) into v_current from public.proof_sessions
      where challenge_assignment_id = a.id and kind = 'reveil' and status = 'completed';
    when 'wakes' then
      select count(*) into v_current from public.proof_sessions
      where enrollment_id = a.enrollment_id and kind = 'reveil' and status = 'completed'
        and day between v_from and v_to
        and (ended_at at time zone 'Europe/Paris')::time <= (v_rule ->> 'before')::time;
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

-- Attribue l'épreuve de la semaine en cours si elle manque. Un piège toutes les 4 semaines.
create function public._ensure_assignment(p_enrollment uuid) returns void
language plpgsql set search_path = '' as $$
declare
  e public.enrollments;
  c public.cohorts;
  v_today date := public.paris_today();
  v_week int;
  v_challenge uuid;
  v_kind text;
begin
  select * into e from public.enrollments where id = p_enrollment;
  if e.status <> 'active' or e.started_on is null then
    return;
  end if;
  select * into c from public.cohorts where id = e.cohort_id;
  if v_today < greatest(c.start_date, e.started_on) or v_today > c.end_date then
    return;
  end if;
  v_week := public._arc_week(c.start_date, v_today);
  if v_week > 14 or exists (select 1 from public.challenge_assignments where enrollment_id = e.id and week = v_week) then
    return;
  end if;
  v_kind := case when v_week % 4 = 0 then 'piege' else 'epreuve' end;

  select ch.id into v_challenge from public.challenges ch
  where ch.kind = v_kind
    and (v_kind = 'piege' or (ch.category = e.category and ch.level = e.level))
    and ch.id not in (select challenge_id from public.challenge_assignments where enrollment_id = e.id)
  order by random()
  limit 1;
  -- Bibliothèque épuisée : on autorise une répétition.
  if v_challenge is null then
    select ch.id into v_challenge from public.challenges ch
    where ch.kind = v_kind and (v_kind = 'piege' or (ch.category = e.category and ch.level = e.level))
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
  c public.cohorts;
begin
  select * into a from public.challenge_assignments where id = p_assignment;
  if a.id is not null then
    select * into e from public.enrollments where id = a.enrollment_id;
  end if;
  if a.id is null or e.user_id <> p_user then
    raise exception 'Épreuve introuvable.';
  end if;
  if e.status <> 'active' then
    raise exception 'Ton arc n''est pas actif.';
  end if;
  select * into c from public.cohorts where id = e.cohort_id;
  if public._arc_week(c.start_date, public.paris_today()) <> a.week or public.paris_today() > c.end_date then
    raise exception 'Cette épreuve n''est plus en cours.';
  end if;
  if a.status <> 'assigned' then
    raise exception 'Épreuve déjà jugée.';
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
begin
  select * into ch from public.challenges where id = a.challenge_id;
  if ch.proof_type is distinct from p_kind then
    raise exception 'Cette épreuve demande une autre preuve.';
  end if;
  if p_kind in ('declaratif', 'photo') and exists (
    select 1 from public.challenge_proofs where assignment_id = a.id and kind = p_kind and status <> 'rejected'
  ) then
    raise exception 'Épreuve déjà prouvée.';
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
  return jsonb_build_object('status', public._evaluate_assignment(a.id, false), 'audit', v_audit);
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
    raise exception 'Un seul lien par jour compte pour cette épreuve.';
  end if;
  return public._add_challenge_proof(v_user, a.id, 'lien', v_link, null);
end;
$$;

create function public.validate_challenge_photo(p_user uuid, p_assignment_id uuid, p_path text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_path !~ ('^' || p_user::text || '/[0-9a-f-]{36}\.jpg$') or not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'proofs' and o.name = p_path and o.created_at > now() - interval '15 minutes'
  ) then
    raise exception 'Photo introuvable.';
  end if;
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
    raise exception 'Cette épreuve demande une autre preuve.';
  end if;
  if ch.proof_type = 'session' and (p_minutes is null or p_minutes not in (25, 50, 90)) then
    raise exception 'Durée invalide.';
  end if;
  if ch.proof_type = 'reveil' then
    v_before := (ch.rule ->> 'before')::time;
    if ch.rule ? 'isodow' and extract(isodow from v_today)::int <> (ch.rule ->> 'isodow')::int then
      raise exception 'Ce n''est pas le bon jour pour cette épreuve.';
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
  if p_path !~ ('^' || p_user::text || '/[0-9a-f-]{36}\.jpg$') or not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'proofs' and o.name = p_path and o.created_at > now() - interval '15 minutes'
  ) then
    raise exception 'Photo introuvable.';
  end if;
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
  else
    update public.challenge_proofs set status = 'valid' where id = au.challenge_proof_id;
  end if;
  perform public._check_achievements(au.enrollment_id);
end;
$$;

-- ===========================================================================
-- Succès
-- ===========================================================================
create function public._unlock(p_enrollment uuid, p_code text) returns void
language plpgsql set search_path = '' as $$
declare
  a public.achievements;
  e public.enrollments;
begin
  select * into a from public.achievements where code = p_code;
  select * into e from public.enrollments where id = p_enrollment;
  if a.id is null or e.id is null then
    return;
  end if;
  insert into public.user_achievements (user_id, achievement_id, enrollment_id)
  values (e.user_id, a.id, e.id)
  on conflict do nothing;
  if found then
    perform public._award(e.id, e.user_id, public.paris_today(), a.points, 'achievement',
      public._ref('achievement:' || a.id || ':' || e.id));
  end if;
end;
$$;

-- Plus longue suite de jours consécutifs parmi une liste.
create function public._longest_run(p_days date[]) returns int
language sql immutable set search_path = '' as $$
  select coalesce(max(n), 0)::int from (
    select count(*) as n
    from (select d, d - (row_number() over (order by d))::int as grp from unnest(p_days) d) t
    group by grp
  ) runs;
$$;

create function public._check_achievements(p_enrollment uuid) returns void
language plpgsql set search_path = '' as $$
declare
  e public.enrollments;
  c public.cohorts;
  v_closed int;
  v_minutes int;
  v_reps int;
begin
  select * into e from public.enrollments where id = p_enrollment;
  if e.id is null then
    return;
  end if;
  select * into c from public.cohorts where id = e.cohort_id;

  if exists (select 1 from public.day_status where enrollment_id = e.id and status = 'green') then
    perform public._unlock(e.id, 'premier_vert');
  end if;

  if public._longest_run(array(
    select day from public.day_status where enrollment_id = e.id and status = 'green'
  )) >= 7 then
    perform public._unlock(e.id, 'premiere_semaine_parfaite');
  end if;

  select count(*) into v_closed from public.day_status where enrollment_id = e.id;
  if v_closed >= 30 and not exists (
    select 1 from public.misses m
    where m.enrollment_id = e.id and m.streak >= 2
      and m.day > (select max(day) - 30 from public.day_status where enrollment_id = e.id)
  ) then
    perform public._unlock(e.id, 'jamais_deux_fois');
  end if;

  if (
    select count(*) from public.validations v
    join public.proof_sessions s on s.id = v.proof_session_id
    where v.enrollment_id = e.id and v.proof_type = 'reveil' and v.status <> 'rejected'
      and (s.ended_at at time zone 'Europe/Paris')::time < '06:30'
  ) >= 10 then
    perform public._unlock(e.id, 'aube');
  end if;

  select coalesce(sum(minutes), 0) into v_minutes from public.proof_sessions
  where enrollment_id = e.id and kind = 'session' and status = 'completed';
  if v_minutes >= 600 then perform public._unlock(e.id, 'travail_profond_1'); end if;
  if v_minutes >= 3000 then perform public._unlock(e.id, 'travail_profond_2'); end if;
  if v_minutes >= 6000 then perform public._unlock(e.id, 'travail_profond_3'); end if;

  select coalesce(sum((data ->> 'count')::int), 0) into v_reps from public.proof_sessions
  where enrollment_id = e.id and kind = 'reps' and status = 'completed';
  if v_reps >= 1000 then perform public._unlock(e.id, 'mille'); end if;

  if public._longest_run(array(
    select ds.day from public.day_status ds
    where ds.enrollment_id = e.id and ds.status = 'green'
      and not exists (
        select 1 from public.validations v
        where v.enrollment_id = e.id and v.day = ds.day and v.strength = 'faible'
      )
  )) >= 14 then
    perform public._unlock(e.id, 'sans_filet');
  end if;

  if (select count(*) from public.audits where enrollment_id = e.id and status = 'passed') >= 5 then
    perform public._unlock(e.id, 'controle');
  end if;

  if exists (select 1 from public.day_status where enrollment_id = e.id and day = c.start_date + 44)
    and not exists (select 1 from public.day_status where enrollment_id = e.id and status = 'white') then
    perform public._unlock(e.id, 'mi_parcours');
  end if;

  if e.status = 'completed' then
    perform public._unlock(e.id, 'arc_tenu');
  end if;
end;
$$;

-- ===========================================================================
-- Clôture d'une journée (§6) : ratés, « jamais deux fois », jours blancs, semaine parfaite, abandon
-- ===========================================================================
create function public.close_day(p_enrollment uuid, p_day date) returns text
language plpgsql set search_path = '' as $$
declare
  e public.enrollments;
  c public.cohorts;
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
begin
  select * into e from public.enrollments where id = p_enrollment for update;
  if e.id is null or e.status <> 'active' or e.started_on is null then
    return 'skipped';
  end if;
  select * into c from public.cohorts where id = e.cohort_id;
  if p_day < e.started_on or p_day > c.end_date or p_day >= public.paris_today() then
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
  v_white := not v_opened;

  for p in
    select * from public.principles
    where enrollment_id = e.id and public._is_scheduled(days, p_day)
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

    -- Occurrence précédente de ce principe (sur 7 jours) : ratée aussi ?
    select max(d)::date into v_prev_day
    from generate_series(greatest(e.started_on, p_day - 7)::timestamp, (p_day - 1)::timestamp, interval '1 day') d
    where public._is_scheduled(p.days, d::date);
    v_prev_streak := 0;
    if v_prev_day is not null then
      select m.streak into v_prev_streak from public.misses m where m.principle_id = p.id and m.day = v_prev_day;
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
  insert into public.day_status (enrollment_id, day, status, opened_app) values (e.id, p_day, v_status, v_opened);

  -- Semaine parfaite : du lundi au dimanche, 7 jours verts.
  if extract(isodow from p_day)::int = 7 and p_day - 6 >= e.started_on and (
    select count(*) from public.day_status
    where enrollment_id = e.id and day between p_day - 6 and p_day and status = 'green'
  ) = 7 then
    perform public._award(e.id, e.user_id, p_day, 50, 'perfect_week', public._ref('perfect_week:' || e.id || ':' || p_day));
  end if;

  for v_assignment in
    select a.id from public.challenge_assignments a
    join public.challenges ch on ch.id = a.challenge_id
    where a.enrollment_id = e.id and a.status = 'assigned' and ch.rule ->> 'type' = 'green_day'
  loop
    perform public._evaluate_assignment(v_assignment, false);
  end loop;

  -- Abandon : 7 jours blancs d'affilée.
  if (
    select count(*) from (
      select status from public.day_status where enrollment_id = e.id order by day desc limit 7
    ) last7 where last7.status = 'white'
  ) = 7 then
    update public.enrollments set status = 'abandoned' where id = e.id;
    if e.stake_status = 'held' then
      update public.enrollments set stake_status = 'forfeited' where id = e.id;
    end if;
  end if;

  perform public._check_achievements(e.id);
  return 'closed';
end;
$$;
