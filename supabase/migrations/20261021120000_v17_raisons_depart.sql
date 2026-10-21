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
