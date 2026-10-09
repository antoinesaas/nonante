-- V7 (9 octobre 2026) : les parties. Plus de départ unique du 1er janvier : une partie officielle par catégorie
-- (études, business, les deux) qui part chaque lundi, et chaque escouade peut fixer un jour 1 commun ; les parties
-- publiques ouvertes sont proposées à l'inscription, et la rejoindre donne son jour 1.

alter table public.squads add column if not exists category text check (category in ('etudes', 'business', 'mixte'));

delete from public.squads where code = 'JANV27';

insert into public.squads (name, description, code, is_public, is_official, category) values
  ('Partie Études', 'Les étudiants qui se lancent ensemble. Départ chaque lundi.', 'ETUDES', true, true, 'etudes'),
  ('Partie Business', 'Les entrepreneurs qui se lancent ensemble. Départ chaque lundi.', 'PROJET', true, true, 'business'),
  ('Partie Études + Business', 'Les cours le jour, le projet le soir. Départ chaque lundi.', 'DOUBLE', true, true, 'mixte')
on conflict (code) do nothing;

-- Jour 1 d'une partie : sa date, sinon le lundi qui vient pour une partie officielle (elle ne ferme jamais).
create or replace function public._party_start(sq public.squads) returns date
language sql stable set search_path = '' as $$
  select case
    when sq.start_date is not null then sq.start_date
    when sq.is_official then public.paris_today() + (8 - extract(isodow from public.paris_today())::int)
  end;
$$;

create or replace function public._squad_json(sq public.squads, p_user uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', sq.id, 'name', sq.name, 'description', sq.description, 'is_public', sq.is_public,
    'is_official', sq.is_official, 'start_date', public._party_start(sq), 'category', sq.category,
    'members', (select count(*) from public.squad_members m where m.squad_id = sq.id),
    'is_member', exists (select 1 from public.squad_members m where m.squad_id = sq.id and m.user_id = p_user),
    'is_owner', sq.owner_id is not distinct from p_user and p_user is not null,
    'code', case when exists (select 1 from public.squad_members m where m.squad_id = sq.id and m.user_id = p_user)
      then sq.code end
  );
$$;

create or replace function public._join_squad(p_user uuid, sq public.squads) returns void
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.squad_members where squad_id = sq.id and user_id = p_user) then
    return;
  end if;
  -- Les parties officielles n'ont pas de limite de joueurs.
  if not sq.is_official and (select count(*) from public.squad_members where squad_id = sq.id) >= 50 then
    raise exception 'Escouade complète (50 membres).';
  end if;
  if (select count(*) from public.squad_members where user_id = p_user) >= 3 then
    raise exception 'Tu fais déjà partie de 3 escouades.';
  end if;
  insert into public.squad_members (squad_id, user_id) values (sq.id, p_user);
  perform public._after_change(p_user);
end;
$$;

drop function if exists public.create_squad(text, text, boolean);
create function public.create_squad(
  p_name text, p_description text, p_is_public boolean, p_start_date date default null, p_category text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_desc text := nullif(regexp_replace(btrim(coalesce(p_description, '')), '\s+', ' ', 'g'), '');
  v_code text;
  sq public.squads;
begin
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Crée ton profil d''abord.';
  end if;
  if not coalesce((public._limits(public._plan(v_user)) ->> 'create_squad')::boolean, false) then
    raise exception 'Créer une escouade fait partie du plan Pro.';
  end if;
  if length(v_name) < 3 or length(v_name) > 40 then
    raise exception 'Nom : de 3 à 40 caractères.';
  end if;
  if length(coalesce(v_desc, '')) > 160 then
    raise exception 'Description : 160 caractères au plus.';
  end if;
  if p_start_date is not null and (p_start_date < public.paris_today() or p_start_date > public.paris_today() + 120) then
    raise exception 'Jour 1 de la partie : entre aujourd''hui et les 4 prochains mois.';
  end if;
  if p_category is not null and p_category not in ('etudes', 'business', 'mixte') then
    raise exception 'Catégorie invalide.';
  end if;
  if (select count(*) from public.squads where owner_id = v_user and not is_official) >= 3 then
    raise exception 'Tu as déjà créé 3 escouades.';
  end if;
  if (select count(*) from public.squad_members where user_id = v_user) >= 3 then
    raise exception 'Tu fais déjà partie de 3 escouades.';
  end if;
  loop
    v_code := public._squad_code();
    exit when not exists (select 1 from public.squads where code = v_code);
  end loop;
  insert into public.squads (name, description, code, owner_id, is_public, start_date, category)
  values (v_name, v_desc, v_code, v_user, coalesce(p_is_public, false), p_start_date, p_category)
  returning * into sq;
  perform public._join_squad(v_user, sq);
  return v_code;
end;
$$;

-- Parties ouvertes, proposées à l'inscription (le questionnaire garde celles de la catégorie du joueur).
create or replace function public.collective_starts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'start_date', x.start, 'members', x.members,
    'official', x.is_official, 'category', x.category) order by x.is_official desc, x.start, x.members desc), '[]'::jsonb)
  from (
    select sq.id, sq.name, sq.is_official, sq.category, public._party_start(sq) as start,
      (select count(*) from public.squad_members m where m.squad_id = sq.id) as members
    from public.squads sq
    where (sq.is_public or sq.is_official)
      and public._party_start(sq) between public.paris_today() and public.paris_today() + 120
    order by sq.is_official desc, public._party_start(sq)
    limit 12
  ) x;
$$;

create or replace function public.save_arc(
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
  p_locale text default 'fr',
  p_business_types text[] default '{}',
  p_business_other text default null,
  p_school text default null,
  p_school_other text default null
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

  -- Partie rejointe : son jour 1 devient celui du joueur.
  if p_squad_id is not null then
    select * into s from public.squads where id = p_squad_id and (is_public or is_official);
    if s.id is null or public._party_start(s) is null or public._party_start(s) < v_today then
      raise exception 'Cette partie n''est plus ouverte.';
    end if;
    if not s.is_official and (select count(*) from public.squad_members m where m.squad_id = s.id) >= 50
      and not exists (select 1 from public.squad_members m where m.squad_id = s.id and m.user_id = v_user) then
      raise exception 'Cette partie est complète (50 joueurs).';
    end if;
    v_start := public._party_start(s);
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
      goal_unit, goal_public, weak_points, wake_time, pushups, focus_minutes, utm_source, utm_campaign, locale,
      business_types, business_other, school, school_other)
    select v_user, v_number, v_start, p_category, p_goal_type, v_goal, p_goal_target, v_unit, coalesce(p_goal_public, false),
      v_weak, v_wake, p_pushups, p_focus_minutes, pr.utm_source, pr.utm_campaign, public._locale(p_locale),
      case when p_category <> 'etudes' then public._clean_business(p_business_types) else '{}' end,
      case when p_category <> 'etudes' then nullif(left(btrim(coalesce(p_business_other, '')), 60), '') end,
      case when p_category <> 'business' then public._clean_school(p_school) end,
      case when p_category <> 'business' then nullif(left(btrim(coalesce(p_school_other, '')), 60), '') end
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
        pushups = p_pushups, focus_minutes = p_focus_minutes, start_date = v_start, locale = public._locale(p_locale),
        business_types = case when p_category <> 'etudes' then public._clean_business(p_business_types) else '{}' end,
        business_other = case when p_category <> 'etudes' then nullif(left(btrim(coalesce(p_business_other, '')), 60), '') end,
        school = case when p_category <> 'business' then public._clean_school(p_school) end,
        school_other = case when p_category <> 'business' then nullif(left(btrim(coalesce(p_school_other, '')), 60), '') end
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

revoke execute on function public._party_start(public.squads) from public, anon, authenticated;
grant execute on function public.create_squad(text, text, boolean, date, text) to authenticated;
