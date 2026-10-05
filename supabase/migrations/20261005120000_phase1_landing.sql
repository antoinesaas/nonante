-- Phase 1 : landing, liste d'attente, préventes.
-- Tables : cohorts, waitlist, presales, stripe_events, rate_limits.
-- RLS activée partout. Le client (anon / authenticated) ne peut que lire
-- les colonnes publiques des cohortes et appeler cohort_signups().
-- Toutes les écritures passent par le serveur (clé service_role, fichiers 'server-only').

-- ---------------------------------------------------------------------------
-- Cohortes
-- ---------------------------------------------------------------------------
create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  start_date date not null,
  -- Un arc dure 90 jours : fin = départ + 89 jours. Calculée, jamais saisie.
  end_date date not null generated always as (start_date + 89) stored,
  enroll_open boolean not null default true,
  price_cents int not null default 1900 check (price_cents > 0),
  early_price_cents int not null default 1500 check (early_price_cents > 0),
  stripe_price_id text,
  stripe_early_price_id text,
  created_at timestamptz not null default now()
);

alter table public.cohorts enable row level security;

create policy "cohorts : lecture publique"
  on public.cohorts for select
  to anon, authenticated
  using (true);

-- Lecture limitée aux colonnes publiques (pas les identifiants Stripe).
revoke all on public.cohorts from anon, authenticated;
grant select (id, name, start_date, end_date, enroll_open, price_cents, early_price_cents)
  on public.cohorts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Liste d'attente
-- ---------------------------------------------------------------------------
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and length(email) between 3 and 254),
  cohort_id uuid references public.cohorts (id) on delete set null,
  utm_source text check (length(utm_source) <= 100),
  utm_campaign text check (length(utm_campaign) <= 100),
  created_at timestamptz not null default now(),
  -- Une seule inscription par email et par cohorte (y compris « aucune cohorte »).
  unique nulls not distinct (email, cohort_id)
);

create index waitlist_cohort_id_idx on public.waitlist (cohort_id);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Préventes : paiements reçus avant que le compte existe (phase 1).
-- Reliées à un compte (claimed_by) quand l'utilisateur se connecte avec le même email.
-- ---------------------------------------------------------------------------
create table public.presales (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts (id) on delete restrict,
  email text not null check (email = lower(email) and length(email) between 3 and 254),
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_promotion_code_id text,
  amount_paid_cents int not null check (amount_paid_cents >= 0),
  currency text not null default 'eur',
  utm_source text check (length(utm_source) <= 100),
  utm_campaign text check (length(utm_campaign) <= 100),
  paid_at timestamptz not null default now(),
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);

create index presales_email_idx on public.presales (email);
create index presales_cohort_id_idx on public.presales (cohort_id);
create index presales_claimed_by_idx on public.presales (claimed_by);

alter table public.presales enable row level security;
revoke all on public.presales from anon, authenticated;

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
-- Limitation de débit (fenêtre fixe). Clé = action + empreinte HMAC de l'IP.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  bucket text primary key check (length(bucket) <= 200),
  hits int not null,
  reset_at timestamptz not null
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Renvoie true si l'appel est autorisé, false si la limite est atteinte.
create function public.rate_limit_hit(p_bucket text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hits int;
begin
  insert into public.rate_limits as r (bucket, hits, reset_at)
  values (p_bucket, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket) do update set
    hits = case when r.reset_at <= now() then 1 else r.hits + 1 end,
    reset_at = case
      when r.reset_at <= now() then now() + make_interval(secs => p_window_seconds)
      else r.reset_at
    end
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$$;

revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- Statistique publique : nombre réel d'inscrits payés d'une cohorte.
-- Phase 1 : préventes non remboursées, une personne = un email.
-- Les inscriptions (enrollments) s'y ajouteront en phase 3.
-- ---------------------------------------------------------------------------
create function public.cohort_signups(p_cohort_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct p.email)::int
  from public.presales p
  where p.cohort_id = p_cohort_id
    and p.refunded_at is null;
$$;

revoke execute on function public.cohort_signups(uuid) from public;
grant execute on function public.cohort_signups(uuid) to anon, authenticated, service_role;
