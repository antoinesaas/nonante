-- Production : v16 + v17 + v18 (entonnoir, raisons de départ, répétitions), à coller dans l'éditeur SQL de Supabase.
begin;
-- V16 (21 octobre 2026) : mesure du parcours chez Nonante, sans Vercel Pro. Évènements anonymes (écran du
-- questionnaire, plan choisi, paiement lancé, minuteur, calcul mental), écrits par le serveur seulement (route
-- /api/track, clé service_role, limite par adresse), lus dans /admin/entonnoir. Aucun compte, aucune adresse IP,
-- aucun cookie : « visit » est un identifiant tiré au hasard à chaque chargement de page, gardé en mémoire.
-- Effacés après 180 jours (tâche de nettoyage).

create table if not exists public.analytics_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  day date not null default public.paris_today(),
  visit text not null check (visit ~ '^[a-z0-9]{8,32}$'),
  name text not null check (name in ('questionnaire', 'plan_choisi', 'paiement_lance', 'session', 'calcul_mental', 'depart')),
  props jsonb not null default '{}' check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 1000),
  path text check (length(path) <= 200),
  device text check (device in ('mobile', 'desktop'))
);
create index if not exists analytics_events_name_day_idx on public.analytics_events (name, day);
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
revoke all on sequence public.analytics_events_id_seq from anon, authenticated;

-- Écriture (serveur seulement).
create or replace function public.track_event(p_visit text, p_name text, p_props jsonb, p_path text, p_device text)
returns void
language sql security definer set search_path = '' as $$
  insert into public.analytics_events (visit, name, props, path, device)
  values (p_visit, p_name, coalesce(p_props, '{}'::jsonb), left(p_path, 200),
    case when p_device in ('mobile', 'desktop') then p_device end);
$$;
revoke execute on function public.track_event(text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.track_event(text, text, jsonb, text, text) to service_role;

create or replace function public.cron_analytics_cleanup() returns int
language sql security definer set search_path = '' as $$
  with gone as (delete from public.analytics_events where day < public.paris_today() - 180 returning 1)
  select count(*)::int from gone;
$$;
revoke execute on function public.cron_analytics_cleanup() from public, anon, authenticated;
grant execute on function public.cron_analytics_cleanup() to service_role;

-- Entonnoir pour l'admin : visites distinctes par écran du questionnaire, plans choisis, paiements lancés,
-- sessions du minuteur, calcul mental, sur les p_days derniers jours.
create or replace function public.admin_funnel(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from date := public.paris_today() - (least(greatest(coalesce(p_days, 30), 1), 180) - 1);
begin
  perform public._require_admin();
  return jsonb_build_object(
    'from', v_from,
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'visits', d.visits) order by d.day), '[]'::jsonb)
      from (select day, count(distinct visit)::int as visits from public.analytics_events
            where name = 'questionnaire' and day >= v_from group by day) d
    ),
    'quiz', (
      select coalesce(jsonb_agg(jsonb_build_object('screen', q.screen, 'visits', q.visits, 'mobile', q.mobile) order by q.ord, q.screen), '[]'::jsonb)
      from (
        select props ->> 'ecran' as screen,
          case when props ->> 'ecran' = 'intro' then 0
               when props ->> 'ecran' ~ '^\d+-' then split_part(props ->> 'ecran', '-', 1)::int
               when props ->> 'ecran' = 'building' then 100
               when props ->> 'ecran' = 'result' then 101
               when props ->> 'ecran' = 'account' then 102
               else 200 end as ord,
          count(distinct visit)::int as visits,
          count(distinct visit) filter (where device = 'mobile')::int as mobile
        from public.analytics_events
        where name = 'questionnaire' and day >= v_from and props ? 'ecran'
        group by 1, 2
      ) q
    ),
    'plans', (
      select coalesce(jsonb_agg(jsonb_build_object('plan', p.plan, 'interval', p.interval, 'visits', p.visits) order by p.visits desc), '[]'::jsonb)
      from (select props ->> 'plan' as plan, props ->> 'interval' as interval, count(distinct visit)::int as visits
            from public.analytics_events where name = 'plan_choisi' and day >= v_from group by 1, 2) p
    ),
    'checkout', (select count(distinct visit)::int from public.analytics_events where name = 'paiement_lance' and day >= v_from),
    'sessions', (
      select coalesce(jsonb_object_agg(s.etat, s.n), '{}'::jsonb)
      from (select props ->> 'etat' as etat, count(*)::int as n from public.analytics_events
            where name = 'session' and day >= v_from and props ? 'etat' group by 1) s
    ),
    'math', (
      select jsonb_build_object('quizzes', count(*)::int,
        'avg_right', round(avg(nullif(props ->> 'justes', '')::numeric), 1),
        'avg_level', round(avg(nullif(props ->> 'niveau', '')::numeric), 1))
      from public.analytics_events where name = 'calcul_mental' and day >= v_from
    )
  );
end;
$$;
revoke execute on function public.admin_funnel(int) from public, anon;
grant execute on function public.admin_funnel(int) to authenticated;
-- V17 (21 octobre 2026) : « Pourquoi tu pars ? ». Quand un visiteur fait demi-tour sur l'arc prêt (plans) ou sur la
-- dernière étape avant le paiement, une feuille lui demande ce qui le retient (raison + message facultatif).
-- Écrit par le serveur seulement (action limitée par adresse), lu dans /admin/entonnoir, effacé après 365 jours.

create table if not exists public.exit_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  place text not null check (place in ('resultat', 'suite')),
  reason text not null check (reason in ('prix', 'moment', 'doute', 'essai', 'confiance', 'autre')),
  message text check (length(message) <= 500),
  user_id uuid references public.profiles (id) on delete set null,
  locale text check (locale in ('fr', 'en', 'de', 'es'))
);
create index if not exists exit_feedback_created_idx on public.exit_feedback (created_at desc);
alter table public.exit_feedback enable row level security;
revoke all on public.exit_feedback from anon, authenticated;

create or replace function public.save_exit_feedback(p_place text, p_reason text, p_message text, p_user uuid, p_locale text)
returns void
language sql security definer set search_path = '' as $$
  insert into public.exit_feedback (place, reason, message, user_id, locale)
  values (p_place, p_reason, nullif(btrim(left(p_message, 500)), ''),
    (select id from public.profiles where id = p_user), p_locale);
$$;
revoke execute on function public.save_exit_feedback(text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.save_exit_feedback(text, text, text, uuid, text) to service_role;

create or replace function public.admin_exit_feedback(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
begin
  perform public._require_admin();
  return jsonb_build_object(
    'reasons', (
      select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'count', r.n) order by r.n desc), '[]'::jsonb)
      from (select reason, count(*)::int as n from public.exit_feedback where created_at >= v_from group by reason) r
    ),
    'latest', (
      select coalesce(jsonb_agg(jsonb_build_object('at', x.created_at, 'place', x.place, 'reason', x.reason,
        'message', x.message, 'pseudo', x.pseudo) order by x.created_at desc), '[]'::jsonb)
      from (select f.created_at, f.place, f.reason, f.message, p.pseudo
            from public.exit_feedback f left join public.profiles p on p.id = f.user_id
            where f.created_at >= v_from order by f.created_at desc limit 50) x
    )
  );
end;
$$;
revoke execute on function public.admin_exit_feedback(int) from public, anon;
grant execute on function public.admin_exit_feedback(int) to authenticated;

-- Nettoyage : évènements après 180 jours, raisons de départ après 365 jours.
create or replace function public.cron_analytics_cleanup() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_n int;
begin
  delete from public.analytics_events where day < public.paris_today() - 180;
  get diagnostics v_n = row_count;
  delete from public.exit_feedback where created_at < now() - interval '365 days';
  return v_n;
end;
$$;
revoke execute on function public.cron_analytics_cleanup() from public, anon, authenticated;
grant execute on function public.cron_analytics_cleanup() to service_role;
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

commit;
