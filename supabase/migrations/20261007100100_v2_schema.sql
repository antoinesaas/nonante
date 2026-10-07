-- V2 · Modèle du jeu. Le client lit ses propres lignes (RLS) et n'écrit jamais directement.

-- ---------------------------------------------------------------------------
-- Profils (joueur + abonnement)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null unique check (pseudo ~ '^[a-z0-9_]{3,20}$'),
  birth_year int not null check (birth_year between 1900 and 2100),
  is_public boolean not null default false,
  avatar_path text check (avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  bio text check (length(bio) <= 140),
  profile_art_slug text check (profile_art_slug ~ '^[a-z0-9-]{1,60}$'),
  wallet_public boolean not null default false,
  referral_code text unique,
  stripe_promotion_code_id text,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  -- Abonnement Pro ou accès à vie Fondateur. L'Arc 90 jours, lui, se paie une fois par arc (enrollments.arc_paid).
  plan text check (plan in ('pro', 'fondateur')),
  plan_interval text check (plan_interval in ('month', 'year', 'lifetime')),
  plan_status text check (length(plan_status) <= 30),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- Accès offert par l'admin (tests, partenaires), jusqu'à une date.
  comp_plan text check (comp_plan in ('arc', 'pro')),
  comp_until date,
  -- Arcs 90 jours payés d'avance, pas encore rattachés à un arc.
  arc_credits int not null default 0 check (arc_credits between 0 and 10),
  -- Fidélité sans abonnement : −50 % sur le prochain Arc 90 jours.
  loyalty_pending boolean not null default false,
  is_admin boolean not null default false,
  refused_proofs int not null default 0,
  email_reminders boolean not null default true,
  utm_source text check (length(utm_source) <= 100),
  utm_campaign text check (length(utm_campaign) <= 100),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles : lecture de son profil" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
revoke all on public.profiles from anon, authenticated;
grant select (id, pseudo, birth_year, is_public, avatar_path, bio, profile_art_slug, wallet_public, referral_code,
  plan, plan_interval, plan_status, current_period_end, cancel_at_period_end, comp_plan, comp_until, arc_credits,
  loyalty_pending, is_admin, refused_proofs, email_reminders, created_at) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Arcs (un arc = 90 jours à partir du jour 1 choisi)
-- ---------------------------------------------------------------------------
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  arc_number int not null default 1,
  start_date date not null,
  end_date date not null generated always as (start_date + 89) stored,
  category text not null check (category in ('etudes', 'business', 'mixte')),
  goal_type text not null check (goal_type in ('revenu', 'clients', 'lancement', 'audience', 'examens', 'corps', 'autre')),
  goal_title text not null check (length(goal_title) between 3 and 120),
  goal_target numeric check (goal_target > 0 and goal_target < 1000000000),
  goal_unit text check (length(goal_unit) between 1 and 20),
  goal_public boolean not null default false,
  weak_points text[] not null default '{}',
  wake_time time not null default '07:00',
  pushups text not null default 'oui' check (pushups in ('oui', 'quelques', 'non')),
  focus_minutes int not null default 50 check (focus_minutes in (25, 50, 90)),
  -- draft : arc construit, pas encore lancé (en attente d'abonnement).
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'failed', 'abandoned')),
  jokers_used int not null default 0 check (jokers_used >= 0),
  before_photo_path text,
  after_photo_path text,
  loyalty_applied_at timestamptz,
  -- Arc 90 jours payé (paiement unique) : référence Stripe, « credit » ou « comp ».
  arc_paid boolean not null default false,
  arc_payment text check (length(arc_payment) <= 255),
  utm_source text check (length(utm_source) <= 100),
  utm_campaign text check (length(utm_campaign) <= 100),
  activated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, arc_number)
);
-- Un seul arc ouvert (en construction ou en cours) par personne.
create unique index enrollments_one_open_idx on public.enrollments (user_id) where status in ('draft', 'active');
alter table public.enrollments enable row level security;
create policy "enrollments : lecture des siens" on public.enrollments
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.enrollments from anon, authenticated;
grant select on public.enrollments to authenticated;

-- ---------------------------------------------------------------------------
-- Bibliothèque de principes (gabarits fondés sur des principes qui marchent)
-- ---------------------------------------------------------------------------
create table public.principle_templates (
  code text primary key,
  pillar text not null check (pillar in ('focus', 'corps', 'business', 'esprit', 'energie')),
  -- Objectifs et points faibles pour lesquels il est proposé en priorité (vide = tous).
  goal_types text[] not null default '{}',
  weak_points text[] not null default '{}',
  categories text[] not null default '{etudes,business,mixte}',
  if_text text not null,
  then_text text not null,
  proof_type text not null check (proof_type in ('session', 'reps', 'reveil', 'photo', 'capture', 'lien', 'declaratif')),
  difficulty int not null default 1 check (difficulty between 1 and 3),
  days int[] not null default '{1,2,3,4,5,6,7}',
  target jsonb not null default '{}',
  why text not null,
  source text not null,
  sort int not null default 0
);
alter table public.principle_templates enable row level security;
create policy "principle_templates : lecture publique" on public.principle_templates
  for select to anon, authenticated using (true);
revoke all on public.principle_templates from anon, authenticated;
grant select on public.principle_templates to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Principes d'un arc, versionnés : pendant l'arc, une modification prend effet le lendemain.
-- ---------------------------------------------------------------------------
create table public.principles (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  position int not null,
  pillar text not null check (pillar in ('focus', 'corps', 'business', 'esprit', 'energie')),
  if_text text not null check (length(if_text) between 2 and 120),
  then_text text not null check (length(then_text) between 2 and 160),
  proof_type text not null check (proof_type in ('session', 'reps', 'reveil', 'photo', 'capture', 'lien', 'declaratif')),
  difficulty int not null check (difficulty between 1 and 3),
  days int[] not null check (days <@ '{1,2,3,4,5,6,7}' and cardinality(days) between 1 and 7),
  target jsonb not null default '{}',
  source text not null check (source in ('template', 'custom')),
  template_code text,
  why text,
  active_from date not null,
  active_until date,
  created_at timestamptz not null default now(),
  check (active_until is null or active_until >= active_from)
);
create index principles_enrollment_idx on public.principles (enrollment_id, active_from);
alter table public.principles enable row level security;
create policy "principles : lecture des siens" on public.principles
  for select to authenticated using (
    enrollment_id in (select e.id from public.enrollments e where e.user_id = (select auth.uid()))
  );
revoke all on public.principles from anon, authenticated;
grant select on public.principles to authenticated;

-- ---------------------------------------------------------------------------
-- Quêtes de la semaine (bibliothèque et attributions)
-- ---------------------------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null check (category in ('etudes', 'business', 'mixte', 'tous')),
  level int not null check (level between 1 and 3),
  title text not null,
  description text not null,
  kind text not null check (kind in ('epreuve', 'piege')),
  -- null : quête jugée automatiquement (ex. journée verte).
  proof_type text check (proof_type in ('session', 'reps', 'reveil', 'photo', 'lien', 'declaratif')),
  rule jsonb not null,
  forced_audit boolean not null default false
);
alter table public.challenges enable row level security;
create policy "challenges : lecture publique" on public.challenges for select to anon, authenticated using (true);
revoke all on public.challenges from anon, authenticated;
grant select on public.challenges to anon, authenticated;

create table public.challenge_assignments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete restrict,
  week int not null check (week between 1 and 13),
  status text not null default 'assigned' check (status in ('assigned', 'done', 'failed')),
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (enrollment_id, week)
);
create index challenge_assignments_challenge_id_idx on public.challenge_assignments (challenge_id);
alter table public.challenge_assignments enable row level security;
create policy "challenge_assignments : lecture des siennes" on public.challenge_assignments
  for select to authenticated using (
    enrollment_id in (select e.id from public.enrollments e where e.user_id = (select auth.uid()))
  );
revoke all on public.challenge_assignments from anon, authenticated;
grant select on public.challenge_assignments to authenticated;

-- ---------------------------------------------------------------------------
-- Sessions de preuve (concentration, répétitions, réveil)
-- ---------------------------------------------------------------------------
create table public.proof_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  principle_id uuid references public.principles (id) on delete cascade,
  challenge_assignment_id uuid references public.challenge_assignments (id) on delete cascade,
  kind text not null check (kind in ('session', 'reps', 'reveil')),
  nonce text not null,
  -- Jour (Paris) où la session a commencé : c'est lui qui compte.
  day date not null,
  minutes int check (minutes in (25, 50, 90)),
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz,
  heartbeats int not null default 0,
  ended_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'broken', 'abandoned', 'expired')),
  data jsonb not null default '{}',
  check (principle_id is not null or challenge_assignment_id is not null)
);
create unique index proof_sessions_one_running_idx on public.proof_sessions (user_id) where status = 'running';
create index proof_sessions_enrollment_day_idx on public.proof_sessions (enrollment_id, day);
create index proof_sessions_principle_id_idx on public.proof_sessions (principle_id);
create index proof_sessions_challenge_assignment_id_idx on public.proof_sessions (challenge_assignment_id);
alter table public.proof_sessions enable row level security;
create policy "proof_sessions : lecture des siennes" on public.proof_sessions
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.proof_sessions from anon, authenticated;
-- Ni le nonce ni les données internes (code de réveil haché) ne sont lisibles.
grant select (id, user_id, enrollment_id, principle_id, challenge_assignment_id, kind, day, minutes,
  started_at, last_heartbeat_at, heartbeats, ended_at, status) on public.proof_sessions to authenticated;

-- ---------------------------------------------------------------------------
-- Validations
-- ---------------------------------------------------------------------------
create table public.validations (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  principle_id uuid not null references public.principles (id) on delete cascade,
  day date not null,
  pillar text not null,
  proof_type text not null check (proof_type in ('session', 'reps', 'reveil', 'photo', 'capture', 'lien', 'declaratif')),
  strength text not null check (strength in ('forte', 'faible')),
  points int not null,
  proof_session_id uuid references public.proof_sessions (id) on delete set null,
  photo_path text,
  link_url text,
  photo_deleted_at timestamptz,
  status text not null default 'valid' check (status in ('valid', 'audit_pending', 'rejected')),
  created_at timestamptz not null default now(),
  unique (principle_id, day)
);
create unique index validations_link_url_key on public.validations (link_url) where link_url is not null;
create unique index validations_photo_path_key on public.validations (photo_path) where photo_path is not null;
create index validations_enrollment_day_idx on public.validations (enrollment_id, day);
create index validations_proof_session_id_idx on public.validations (proof_session_id);
alter table public.validations enable row level security;
create policy "validations : lecture des siennes" on public.validations
  for select to authenticated using (
    enrollment_id in (select e.id from public.enrollments e where e.user_id = (select auth.uid()))
  );
revoke all on public.validations from anon, authenticated;
grant select on public.validations to authenticated;

create table public.challenge_proofs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.challenge_assignments (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('declaratif', 'photo', 'lien')),
  link_url text,
  photo_path text,
  photo_deleted_at timestamptz,
  status text not null default 'valid' check (status in ('valid', 'audit_pending', 'rejected')),
  created_at timestamptz not null default now()
);
create unique index challenge_proofs_link_url_key on public.challenge_proofs (link_url) where link_url is not null;
create unique index challenge_proofs_photo_path_key on public.challenge_proofs (photo_path) where photo_path is not null;
create index challenge_proofs_assignment_id_idx on public.challenge_proofs (assignment_id);
alter table public.challenge_proofs enable row level security;
create policy "challenge_proofs : lecture des siennes" on public.challenge_proofs
  for select to authenticated using (
    assignment_id in (
      select a.id from public.challenge_assignments a
      join public.enrollments e on e.id = a.enrollment_id
      where e.user_id = (select auth.uid())
    )
  );
revoke all on public.challenge_proofs from anon, authenticated;
grant select on public.challenge_proofs to authenticated;

-- ---------------------------------------------------------------------------
-- Portefeuille : l'argent gagné grâce à son projet (suivi personnel, jamais un gain versé par Nonante)
-- ---------------------------------------------------------------------------
create table public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  day date not null,
  amount_cents int not null check (amount_cents between 1 and 100000000),
  source text not null check (source in ('vente', 'client', 'freelance', 'contenu', 'autre')),
  label text not null check (length(label) between 2 and 80),
  proof_path text,
  proof_deleted_at timestamptz,
  status text not null default 'declared' check (status in ('declared', 'proven', 'audit_pending', 'rejected')),
  created_at timestamptz not null default now()
);
create unique index wallet_entries_proof_path_key on public.wallet_entries (proof_path) where proof_path is not null;
create index wallet_entries_user_day_idx on public.wallet_entries (user_id, day);
create index wallet_entries_enrollment_idx on public.wallet_entries (enrollment_id);
alter table public.wallet_entries enable row level security;
create policy "wallet_entries : lecture des siennes" on public.wallet_entries
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.wallet_entries from anon, authenticated;
grant select on public.wallet_entries to authenticated;

-- ---------------------------------------------------------------------------
-- Contrôles aléatoires (validation, preuve de quête ou revenu)
-- ---------------------------------------------------------------------------
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  validation_id uuid unique references public.validations (id) on delete cascade,
  challenge_proof_id uuid unique references public.challenge_proofs (id) on delete cascade,
  wallet_entry_id uuid unique references public.wallet_entries (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  requested_at timestamptz not null default now(),
  due_at timestamptz not null,
  photo_path text,
  photo_deleted_at timestamptz,
  submitted_at timestamptz,
  status text not null default 'open' check (status in ('open', 'submitted', 'passed', 'failed')),
  penalty int not null default 0,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  check (num_nonnulls(validation_id, challenge_proof_id, wallet_entry_id) = 1)
);
create index audits_status_due_idx on public.audits (status, due_at);
create index audits_enrollment_id_idx on public.audits (enrollment_id);
create index audits_user_id_idx on public.audits (user_id);
create index audits_reviewed_by_idx on public.audits (reviewed_by);
alter table public.audits enable row level security;
create policy "audits : lecture des siens" on public.audits
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.audits from anon, authenticated;
grant select on public.audits to authenticated;

-- ---------------------------------------------------------------------------
-- Jours
-- ---------------------------------------------------------------------------
create table public.day_status (
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  day date not null,
  status text not null check (status in ('green', 'red', 'white', 'joker')),
  opened_app boolean not null,
  closed_at timestamptz not null default now(),
  primary key (enrollment_id, day)
);
alter table public.day_status enable row level security;
create policy "day_status : lecture des siens" on public.day_status
  for select to authenticated using (
    enrollment_id in (select e.id from public.enrollments e where e.user_id = (select auth.uid()))
  );
revoke all on public.day_status from anon, authenticated;
grant select on public.day_status to authenticated;

create table public.app_opens (
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  day date not null,
  primary key (enrollment_id, day)
);
alter table public.app_opens enable row level security;
create policy "app_opens : lecture des siennes" on public.app_opens
  for select to authenticated using (
    enrollment_id in (select e.id from public.enrollments e where e.user_id = (select auth.uid()))
  );
revoke all on public.app_opens from anon, authenticated;
grant select on public.app_opens to authenticated;

-- Jokers posés : la journée devient neutre (ni points ni pénalité).
create table public.joker_days (
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (enrollment_id, day)
);
alter table public.joker_days enable row level security;
create policy "joker_days : lecture des siens" on public.joker_days
  for select to authenticated using (
    enrollment_id in (select e.id from public.enrollments e where e.user_id = (select auth.uid()))
  );
revoke all on public.joker_days from anon, authenticated;
grant select on public.joker_days to authenticated;

-- Principes ratés : sert à la règle « jamais deux fois ».
create table public.misses (
  principle_id uuid not null references public.principles (id) on delete cascade,
  day date not null,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  streak int not null check (streak >= 1),
  white boolean not null,
  points int not null,
  primary key (principle_id, day)
);
create index misses_enrollment_day_idx on public.misses (enrollment_id, day);
alter table public.misses enable row level security;
create policy "misses : lecture des siens" on public.misses
  for select to authenticated using (
    enrollment_id in (select e.id from public.enrollments e where e.user_id = (select auth.uid()))
  );
revoke all on public.misses from anon, authenticated;
grant select on public.misses to authenticated;

-- ---------------------------------------------------------------------------
-- Registre des points : AJOUT SEUL
-- ---------------------------------------------------------------------------
create table public.points_ledger (
  id bigserial primary key,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  delta int not null,
  reason text not null check (reason in (
    'validation', 'missed', 'session_broken', 'audit_failed', 'challenge', 'challenge_audit_failed',
    'perfect_week', 'achievement', 'arc_completed', 'wallet', 'wallet_audit_failed'
  )),
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  -- Une même cause ne compte jamais deux fois.
  unique (reason, ref_id)
);
create index points_ledger_enrollment_day_idx on public.points_ledger (enrollment_id, day);
create index points_ledger_user_day_idx on public.points_ledger (user_id, day);
alter table public.points_ledger enable row level security;
create policy "points_ledger : lecture des siens" on public.points_ledger
  for select to authenticated using (user_id = (select auth.uid()));
-- Personne n'écrit directement, pas même la clé service_role : seules les fonctions du jeu ajoutent des lignes.
revoke all on public.points_ledger from anon, authenticated, service_role;
grant select on public.points_ledger to authenticated, service_role;
revoke all on sequence public.points_ledger_id_seq from anon, authenticated, service_role;

create function public.points_ledger_immutable()
returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Seule exception : la suppression de compte (RGPD), qui pose ce drapeau le temps de sa transaction.
  if tg_op = 'DELETE' and current_setting('nonante.account_deletion', true) = 'on' then
    return old;
  end if;
  raise exception 'Le registre des points est en ajout seul.';
end;
$$;

create trigger points_ledger_no_update_delete
  before update or delete on public.points_ledger
  for each row execute function public.points_ledger_immutable();

create function public.points_ledger_no_truncate()
returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Le registre des points est en ajout seul.';
end;
$$;

create trigger points_ledger_no_truncate
  before truncate on public.points_ledger
  for each statement execute function public.points_ledger_no_truncate();

-- Une validation est définitive : seuls le statut (contrôle) et la photo (suppression à 30 jours) bougent.
create function public.validations_final()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('nonante.account_deletion', true) = 'on' then
      return old;
    end if;
    raise exception 'Une validation est définitive.';
  end if;
  if new.id <> old.id or new.enrollment_id <> old.enrollment_id or new.principle_id <> old.principle_id
    or new.day <> old.day or new.proof_type <> old.proof_type or new.strength <> old.strength
    or new.points <> old.points or new.created_at <> old.created_at
    or new.link_url is distinct from old.link_url
    or (new.photo_path is not null and new.photo_path is distinct from old.photo_path) then
    raise exception 'Une validation est définitive.';
  end if;
  return new;
end;
$$;

create trigger validations_final
  before update or delete on public.validations
  for each row execute function public.validations_final();

-- ---------------------------------------------------------------------------
-- Stats de joueur (recalculées par le serveur à chaque validation et à chaque clôture)
-- ---------------------------------------------------------------------------
create table public.player_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  xp int not null default 0,
  level int not null default 1,
  level_seen int not null default 1,
  ovr int not null default 0,
  discipline int not null default 0,
  focus int not null default 0,
  corps int not null default 0,
  business int not null default 0,
  esprit int not null default 0,
  energie int not null default 0,
  streak int not null default 0,
  best_streak int not null default 0,
  green_days int not null default 0,
  focus_minutes int not null default 0,
  reps int not null default 0,
  wakes int not null default 0,
  wallet_proven_cents bigint not null default 0,
  wallet_declared_cents bigint not null default 0,
  arcs_completed int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.player_stats enable row level security;
create policy "player_stats : lecture des siennes" on public.player_stats
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.player_stats from anon, authenticated;
grant select on public.player_stats to authenticated;

-- ---------------------------------------------------------------------------
-- Succès et fonds débloquables
-- ---------------------------------------------------------------------------
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  points int not null default 0,
  art_slug text,
  sort int not null default 0
);
alter table public.achievements enable row level security;
create policy "achievements : lecture publique" on public.achievements for select to anon, authenticated using (true);
revoke all on public.achievements from anon, authenticated;
grant select on public.achievements to anon, authenticated;

-- Un succès s'obtient une fois par joueur (l'arc où il a été obtenu est noté).
create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  unlocked_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, achievement_id)
);
create index user_achievements_achievement_id_idx on public.user_achievements (achievement_id);
create index user_achievements_enrollment_id_idx on public.user_achievements (enrollment_id);
alter table public.user_achievements enable row level security;
create policy "user_achievements : lecture des siens" on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.user_achievements from anon, authenticated;
grant select on public.user_achievements to authenticated;

-- Fonds de carte (crédits dans public/art/credits.json).
create table public.art_unlocks (
  slug text primary key,
  -- 'base' (tout le monde), 'level:<n>' ou 'achievement:<code>'.
  unlock text not null
);
alter table public.art_unlocks enable row level security;
create policy "art_unlocks : lecture publique" on public.art_unlocks for select to anon, authenticated using (true);
revoke all on public.art_unlocks from anon, authenticated;
grant select on public.art_unlocks to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Escouades
-- ---------------------------------------------------------------------------
create table public.squads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 3 and 40),
  description text check (length(description) <= 160),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  owner_id uuid references public.profiles (id) on delete set null,
  is_public boolean not null default false,
  is_official boolean not null default false,
  -- Départ collectif : jour 1 commun proposé à l'onboarding.
  start_date date,
  created_at timestamptz not null default now()
);
create index squads_owner_id_idx on public.squads (owner_id);
alter table public.squads enable row level security;
revoke all on public.squads from anon, authenticated;

create table public.squad_members (
  squad_id uuid not null references public.squads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);
create index squad_members_user_id_idx on public.squad_members (user_id);
alter table public.squad_members enable row level security;
create policy "squad_members : lecture des siennes" on public.squad_members
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.squad_members from anon, authenticated;
grant select on public.squad_members to authenticated;

-- ---------------------------------------------------------------------------
-- Paiements, parrainage
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  stripe_object_id text not null unique,
  kind text not null check (kind in ('arc', 'subscription', 'lifetime')),
  plan text,
  plan_interval text,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'eur',
  utm_source text,
  utm_campaign text,
  paid_at timestamptz not null default now()
);
create index payments_user_id_idx on public.payments (user_id);
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_id uuid not null unique references public.profiles (id) on delete cascade,
  stripe_object_id text,
  reward_cents int not null default 0,
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);
create index referrals_referrer_id_idx on public.referrals (referrer_id);
alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notifications, emails, signalements, journal admin
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions : lecture des siennes" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select (id, user_id, created_at) on public.push_subscriptions to authenticated;

create table public.reminder_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  channel text not null check (channel in ('push', 'email', 'none')),
  sent_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon, authenticated;

-- Un même email (bienvenue, contrôle, récapitulatif, fidélité, bilan) ne part jamais deux fois.
create table public.email_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('welcome', 'audit', 'weekly', 'loyalty', 'arc_result', 'referral')),
  ref text not null check (length(ref) <= 100),
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now()
);
create index reports_reporter_id_idx on public.reports (reporter_id);
create index reports_reported_user_id_idx on public.reports (reported_user_id);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create table public.audit_log (
  id bigserial primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_admin_id_idx on public.audit_log (admin_id);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Stockage : preuves (privé, un dossier par utilisateur) et photos de profil (public)
-- Pas de politique d'écriture : les fichiers passent par le serveur (vérification, ré-encodage).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

create policy "proofs : lecture de ses fichiers" on storage.objects
  for select to authenticated using (
    bucket_id = 'proofs' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
