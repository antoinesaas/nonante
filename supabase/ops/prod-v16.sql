-- Production : v16 (entonnoir maison), à coller dans l'éditeur SQL de Supabase.
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
  name text not null check (name in ('questionnaire', 'plan_choisi', 'paiement_lance', 'session', 'calcul_mental')),
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

commit;
