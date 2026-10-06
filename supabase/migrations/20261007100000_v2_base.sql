-- V2 · Socle : réglages, limitation de débit, événements Stripe, liste d'attente, outils.
-- Règle générale : RLS partout ; le client lit ses propres lignes et n'écrit jamais directement.
-- Toutes les écritures passent par des fonctions security definer (voir les migrations suivantes).

-- ---------------------------------------------------------------------------
-- Réglages modifiables sans redéployer (taux de contrôle, plans et prix)
-- ---------------------------------------------------------------------------
create table public.settings (
  key text primary key,
  value jsonb not null
);
alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Événements Stripe déjà traités (idempotence du webhook)
-- ---------------------------------------------------------------------------
create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Limitation de débit (fenêtre fixe). Clé = action + empreinte HMAC de l'IP ou de l'utilisateur.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  bucket text primary key check (length(bucket) <= 200),
  hits int not null,
  reset_at timestamptz not null
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- true si l'appel est autorisé, false si la limite est atteinte.
create function public.rate_limit_hit(p_bucket text, p_max int, p_window_seconds int)
returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_hits int;
begin
  insert into public.rate_limits as r (bucket, hits, reset_at)
  values (p_bucket, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket) do update set
    hits = case when r.reset_at <= now() then 1 else r.hits + 1 end,
    reset_at = case when r.reset_at <= now() then now() + make_interval(secs => p_window_seconds) else r.reset_at end
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- Liste d'attente (emails captés avant l'inscription, avec la source)
-- ---------------------------------------------------------------------------
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and length(email) between 3 and 254),
  utm_source text check (length(utm_source) <= 100),
  utm_campaign text check (length(utm_campaign) <= 100),
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

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

-- Semaine de l'arc : blocs de 7 jours depuis le jour 1 (1 à 13).
create function public._arc_week(p_start date, p_day date) returns int
language sql immutable set search_path = '' as $$
  select ((p_day - p_start) / 7) + 1;
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

-- Code à 6 chiffres tiré d'un générateur cryptographique (gen_random_uuid utilise pg_strong_random).
create function public._six_digits() returns text
language sql volatile set search_path = '' as $$
  select lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
$$;

create function public._nonce() returns text
language sql volatile set search_path = '' as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

-- Code d'escouade : 6 caractères sans ambiguïté (pas de O/0, I/1).
create function public._squad_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
    1 + (get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), i) % 32), 1), '')
  from generate_series(0, 5) i;
$$;

-- Domaines acceptés pour les preuves par lien.
create function public._link_domains() returns text[]
language sql immutable set search_path = '' as $$
  select array['tiktok.com', 'instagram.com', 'youtube.com', 'linkedin.com', 'x.com', 'twitter.com', 'threads.net',
    'facebook.com', 'github.com', 'medium.com', 'substack.com', 'producthunt.com', 'behance.net', 'dribbble.com',
    'twitch.tv', 'spotify.com', 'pinterest.com', 'reddit.com'];
$$;

-- Normalise un lien et vérifie son domaine. Le serveur ne télécharge jamais l'URL (pas de SSRF).
create function public._normalize_link(p_url text, p_domains text[]) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_url text := btrim(coalesce(p_url, ''));
  v_host text;
  v_rest text;
  v_domains text[] := case when p_domains is null or cardinality(p_domains) = 0 then public._link_domains() else p_domains end;
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
  if not exists (
    select 1 from unnest(v_domains) d
    where regexp_replace(v_host, '^www\.', '') = d or v_host like '%.' || d
  ) then
    raise exception 'Ce lien doit venir de : %.', array_to_string(v_domains, ', ');
  end if;
  if v_rest = '' or v_rest = '/' then
    raise exception 'Colle le lien de ta publication, pas celui du site.';
  end if;
  return 'https://' || v_host || v_rest;
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

-- 'HH:MM' valide (minutes au quart d'heure), sinon null.
create function public._hhmm(p_text text) returns time
language sql immutable set search_path = '' as $$
  select case when coalesce(p_text, '') ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$' then p_text::time end;
$$;
