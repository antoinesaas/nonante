-- Phases 2 à 10 : modèle complet du jeu.
-- Règle : le client lit ses propres lignes (RLS) et n'écrit jamais directement.
-- Toutes les écritures passent par les fonctions de la migration suivante.

-- ---------------------------------------------------------------------------
-- Cohortes : cohortes de test, clôture
-- ---------------------------------------------------------------------------
alter table public.cohorts add column is_test boolean not null default false;
alter table public.cohorts add column closed_at timestamptz;
update public.cohorts set is_test = true where name = 'Cohorte de test';
grant select (is_test) on public.cohorts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Réglages modifiables sans redéployer
-- ---------------------------------------------------------------------------
create table public.settings (
  key text primary key,
  value jsonb not null
);
alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profils
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo text not null unique check (pseudo ~ '^[a-z0-9_]{3,20}$'),
  birth_year int not null check (birth_year between 1900 and 2100),
  is_public boolean not null default false,
  profile_art_slug text check (profile_art_slug ~ '^[a-z0-9-]{1,60}$'),
  referral_code text unique,
  stripe_promotion_code_id text,
  is_admin boolean not null default false,
  refused_proofs int not null default 0,
  email_reminders boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles : lecture de son profil" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Inscriptions à un arc
-- ---------------------------------------------------------------------------
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  cohort_id uuid not null references public.cohorts (id) on delete restrict,
  category text not null check (category in ('etudes', 'business', 'mixte')),
  goal_title text not null check (length(goal_title) between 3 and 120),
  goal_public boolean not null default false,
  weak_moments text[] not null default '{}',
  wake_time time not null default '07:00',
  pushups text not null default 'oui' check (pushups in ('oui', 'quelques', 'non')),
  level int not null default 1 check (level between 1 and 3),
  level_seen int not null default 1,
  last_level_up_week int not null default 0,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'abandoned', 'completed', 'failed')),
  started_on date,
  stripe_checkout_session_id text unique,
  paid_at timestamptz,
  amount_paid_cents int,
  presale_id uuid unique references public.presales (id) on delete set null,
  stake_cents int not null default 0 check (stake_cents >= 0),
  stake_status text not null default 'none' check (stake_status in ('none', 'held', 'refunded', 'forfeited')),
  stake_payment_intent_id text,
  stake_donated_at timestamptz,
  loyalty_code text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, cohort_id)
);
create index enrollments_cohort_id_idx on public.enrollments (cohort_id);
alter table public.enrollments enable row level security;
create policy "enrollments : lecture des siennes" on public.enrollments
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.enrollments from anon, authenticated;
grant select on public.enrollments to authenticated;

-- ---------------------------------------------------------------------------
-- Gabarits et principes
-- ---------------------------------------------------------------------------
create table public.principle_templates (
  code text primary key,
  categories text[] not null default '{etudes,business,mixte}',
  if_text text not null,
  then_text text not null,
  proof_type text not null check (proof_type in ('session', 'reps', 'reveil', 'photo', 'lien', 'declaratif')),
  difficulty int not null check (difficulty between 1 and 3),
  days int[] not null default '{1,2,3,4,5,6,7}',
  target jsonb not null default '{}'
);
alter table public.principle_templates enable row level security;
revoke all on public.principle_templates from anon, authenticated;

create table public.principles (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  position int not null,
  if_text text not null check (length(if_text) between 1 and 120),
  then_text text not null check (length(then_text) between 1 and 160),
  proof_type text not null check (proof_type in ('session', 'reps', 'reveil', 'photo', 'lien', 'declaratif')),
  difficulty int not null check (difficulty between 1 and 3),
  -- Difficulté du gabarit. Au niveau 1, elle est plafonnée à 2 (§7 : le niveau débloque la difficulté 3).
  max_difficulty int not null check (max_difficulty between 1 and 3),
  days int[] not null default '{1,2,3,4,5,6,7}',
  target jsonb not null default '{}',
  source text not null check (source in ('template', 'custom')),
  template_code text,
  created_at timestamptz not null default now(),
  unique (enrollment_id, position)
);
alter table public.principles enable row level security;
create policy "principles : lecture des siens" on public.principles
  for select to authenticated using (
    enrollment_id in (select e.id from public.enrollments e where e.user_id = (select auth.uid()))
  );
revoke all on public.principles from anon, authenticated;
grant select on public.principles to authenticated;

-- ---------------------------------------------------------------------------
-- Épreuves (bibliothèque et attributions)
-- ---------------------------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null check (category in ('etudes', 'business', 'mixte', 'tous')),
  level int not null check (level between 1 and 3),
  title text not null,
  description text not null,
  kind text not null check (kind in ('epreuve', 'piege')),
  -- null : épreuve évaluée automatiquement (ex. journée verte).
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
  -- Semaine de l'arc, du lundi au dimanche. Un arc de 90 jours touche jusqu'à 14 semaines.
  week int not null check (week between 1 and 14),
  status text not null default 'assigned' check (status in ('assigned', 'done', 'failed')),
  validation_id uuid,
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
  proof_type text not null check (proof_type in ('session', 'reps', 'reveil', 'photo', 'lien', 'declaratif')),
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
-- Contrôles aléatoires
-- ---------------------------------------------------------------------------
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  validation_id uuid unique references public.validations (id) on delete cascade,
  challenge_proof_id uuid unique references public.challenge_proofs (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  requested_at timestamptz not null default now(),
  due_at timestamptz not null,
  photo_path text,
  photo_deleted_at timestamptz,
  submitted_at timestamptz,
  status text not null default 'open' check (status in ('open', 'submitted', 'passed', 'failed')),
  -- Points retirés si le contrôle échoue (3 × valeur du principe).
  penalty int not null default 0,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  check (validation_id is not null or challenge_proof_id is not null)
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
  status text not null check (status in ('green', 'red', 'white')),
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
    'perfect_week', 'achievement', 'arc_completed'
  )),
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  -- Une même cause ne compte jamais deux fois.
  unique (reason, ref_id)
);
create index points_ledger_enrollment_day_idx on public.points_ledger (enrollment_id, day);
create index points_ledger_user_id_idx on public.points_ledger (user_id);
alter table public.points_ledger enable row level security;
create policy "points_ledger : lecture des siens" on public.points_ledger
  for select to authenticated using (user_id = (select auth.uid()));
-- Personne n'écrit directement, pas même la clé service_role : seules les fonctions du jeu ajoutent des lignes.
revoke all on public.points_ledger from anon, authenticated, service_role;
grant select on public.points_ledger to authenticated, service_role;
revoke all on sequence public.points_ledger_id_seq from anon, authenticated, service_role;

create function public.points_ledger_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
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
language plpgsql
set search_path = ''
as $$
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
language plpgsql
set search_path = ''
as $$
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
-- Succès
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

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, achievement_id, enrollment_id)
);
create index user_achievements_achievement_id_idx on public.user_achievements (achievement_id);
create index user_achievements_enrollment_id_idx on public.user_achievements (enrollment_id);
alter table public.user_achievements enable row level security;
create policy "user_achievements : lecture des siens" on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.user_achievements from anon, authenticated;
grant select on public.user_achievements to authenticated;

-- Œuvres débloquables (crédits dans public/art/credits.json).
create table public.art_unlocks (
  slug text primary key,
  -- 'base' (tout le monde), 'level:2', 'level:3' ou 'achievement:<code>'.
  unlock text not null
);
alter table public.art_unlocks enable row level security;
create policy "art_unlocks : lecture publique" on public.art_unlocks for select to anon, authenticated using (true);
revoke all on public.art_unlocks from anon, authenticated;
grant select on public.art_unlocks to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notifications, signalements, parrainage, journal admin
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

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  enrollment_id uuid not null unique references public.enrollments (id) on delete cascade,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now()
);
create index referrals_referrer_id_idx on public.referrals (referrer_id);
alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;

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
-- Stockage des preuves : bucket privé, un dossier par utilisateur
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;

create policy "proofs : lecture de ses fichiers" on storage.objects
  for select to authenticated using (
    bucket_id = 'proofs' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
-- Pas de politique d'écriture : les photos passent par le serveur (vérification, ré-encodage).
