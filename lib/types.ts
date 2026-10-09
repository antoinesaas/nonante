// Formes des objets JSON renvoyés par les fonctions Postgres (my_dashboard, my_profile, my_wallet…).

export type ProofType = "session" | "reps" | "reveil" | "photo" | "capture" | "lien" | "declaratif";
export type Pillar = "focus" | "corps" | "business" | "esprit" | "energie";
export type DayStatus = "green" | "red" | "white" | "joker" | "future" | "today" | "pending" | "none";
export type Category = "etudes" | "business" | "mixte";
export type GoalType = "revenu" | "clients" | "lancement" | "audience" | "examens" | "corps" | "autre";
export type PlanId = "arc" | "pro" | "fondateur";
export type Interval = "once" | "month" | "year" | "lifetime";

export type Target = {
  minutes?: number;
  before?: string;
  after?: string;
  exercise?: "pushup" | "squat";
  reps?: number;
  domains?: string[];
  count?: number;
  unit?: string;
};

export type ValidationView = {
  status: "valid" | "audit_pending" | "rejected";
  strength: "forte" | "faible";
  points: number;
  proof_type: ProofType;
};

export type PrincipleView = {
  id: string;
  position: number;
  pillar: Pillar;
  if_text: string;
  then_text: string;
  proof_type: ProofType;
  difficulty: number;
  value: number;
  days: number[];
  target: Target;
  why: string | null;
  validation: ValidationView | null;
};

/** Principe dans l'onglet Principes (version qui s'applique au prochain jour modifiable). */
export type EditablePrinciple = Omit<PrincipleView, "validation"> & {
  source: "template" | "custom";
  template_code: string | null;
  pending: boolean;
};

export type TemplateView = {
  code: string;
  pillar: Pillar;
  if_text: string;
  then_text: string;
  proof_type: ProofType;
  difficulty: number;
  days: number[];
  target: Target;
  why: string;
  source: string;
  recommended: boolean;
  score: number;
  for_business: boolean;
  for_school: boolean;
  added: boolean;
};

export type CalendarDay = { day: string; status: DayStatus };

export type ChallengeRule = {
  type: string;
  count?: number;
  minutes?: number;
  min_minutes?: number;
  before?: string;
  isodow?: number;
  exercise?: string;
  domains?: string[];
};

export type ChallengeView = {
  assignment_id: string;
  code?: string;
  week: number;
  status: "assigned" | "done" | "failed";
  title: string;
  description: string;
  kind: "epreuve" | "piege";
  level: number;
  proof_type: ProofType | null;
  rule: ChallengeRule;
  progress: { current: number; goal: number; met: boolean };
  points_done: number;
  points_failed: number;
};

export type AuditView = { id: string; due_at: string; penalty: number; label: string | null };

export type Stats = {
  xp: number;
  level: number;
  level_floor: number;
  level_next: number;
  ovr: number;
  discipline: number;
  focus: number;
  corps: number;
  business: number;
  esprit: number;
  energie: number;
  streak: number;
  best_streak: number;
  green_days: number;
  focus_minutes: number;
  reps: number;
  wakes: number;
  arcs_completed: number;
  wallet_proven_cents: number;
  wallet_declared_cents: number;
};

export type Limits = { max_principles: number; jokers: number; wallet: boolean; create_squad: boolean };

export type PlanState = {
  plan: PlanId | null;
  paid_plan: PlanId | null;
  interval: Interval | null;
  status: string | null;
  period_end: string | null;
  cancel_at_period_end: boolean;
  comp_until: string | null;
  /** Arc ouvert payé (Arc 90 jours). */
  arc_paid: boolean;
  /** Arcs 90 jours payés d'avance, pas encore rattachés. */
  arc_credits: number;
  /** Fidélité : −50 % sur le prochain Arc 90 jours. */
  loyalty_pending: boolean;
  /** Parrainage : remises de −20 % gagnées, pour les prochains Arcs 90 jours. */
  referral_rewards: number;
  limits: Limits;
};

export type ArcView = {
  id: string;
  status: "draft" | "active" | "completed" | "failed" | "abandoned";
  arc_number: number;
  start_date: string;
  end_date: string;
  category: Category;
  goal_type: GoalType;
  goal_title: string;
  goal_target: number | null;
  goal_unit: string | null;
  jokers_used: number;
  jokers_total: number;
  has_before_photo: boolean;
  has_after_photo: boolean;
};

export type DashboardState = "none" | "draft" | "before" | "running" | "locked" | "closing" | "ended";

export type Dashboard = {
  profile: { pseudo: string; avatar_path: string | null; is_admin: boolean; is_public: boolean; referral_code: string | null } | null;
  plan?: PlanState;
  enrollment?: ArcView | null;
  state?: DashboardState;
  today?: string;
  day_number?: number | null;
  points?: number;
  week_points?: number;
  rank?: number | null;
  total?: number | null;
  stats?: Stats;
  principles?: PrincipleView[];
  calendar?: CalendarDay[];
  challenge?: ChallengeView | null;
  audits?: AuditView[];
  running_session?: { id: string; kind: ProofType; principle_id: string | null; assignment_id: string | null } | null;
  joker_today?: boolean;
  wallet_month_cents?: number;
  unseen_achievements?: number;
  level_up?: boolean;
};

export type DayDetail = {
  day: string;
  status: "green" | "red" | "white" | "joker" | null;
  joker: boolean;
  points: number;
  principles: {
    then_text: string;
    proof_type: ProofType;
    pillar: Pillar;
    validation: { status: string; strength: string; points: number } | null;
    miss: { points: number; streak: number; white: boolean } | null;
  }[];
};

export type MyPrinciples = {
  enrollment: { id: string; status: ArcView["status"]; start_date: string; end_date: string; goal_type: GoalType; goal_title: string; category: Category } | null;
  editable?: boolean;
  started?: boolean;
  effective_day?: string;
  plan?: PlanId | null;
  limits?: Limits;
  principles?: EditablePrinciple[];
  templates?: TemplateView[];
};

export type AchievementView = {
  code: string;
  title: string;
  description: string;
  points: number;
  art_slug: string | null;
  unlocked_at: string | null;
  percent: number | null;
};

export type ArcHistory = {
  number: number;
  status: ArcView["status"];
  start_date: string;
  end_date: string;
  goal_title: string;
  green: number;
  points: number;
  loyalty_applied: boolean;
};

export type MyProfile = {
  pseudo: string;
  email: string;
  avatar_path: string | null;
  bio: string | null;
  is_public: boolean;
  is_admin: boolean;
  email_reminders: boolean;
  wallet_public: boolean;
  profile_art_slug: string;
  refused_proofs: number;
  referral_code: string | null;
  referral_ready: boolean;
  referral_sales: number;
  /** Remises de −20 % gagnées en parrainant, pas encore utilisées. */
  referral_rewards: number;
  has_billing: boolean;
  plan: PlanState;
  stats: Stats;
  points: number;
  rank: number | null;
  arts: string[];
  push_subscriptions: number;
  arcs: ArcHistory[];
  achievements: AchievementView[];
};

export type PublicProfile = {
  pseudo: string;
  avatar_path: string | null;
  bio: string | null;
  art: string;
  founder: boolean;
  refused_proofs: number;
  member_since: string;
  stats: Stats;
  wallet_proven_cents: number | null;
  arc: { number: number; status: string; category: Category; goal_type: GoalType; goal: string | null; day_number: number | null } | null;
  points: number;
  rank: number | null;
  calendar: CalendarDay[];
  achievements: { code: string; title: string; description: string; art_slug: string | null; unlocked_at: string }[];
};

export type LeaderboardRow = {
  rank: number;
  pseudo: string;
  avatar_path: string | null;
  level: number;
  ovr: number;
  category: Category | null;
  country: string | null;
  points: number;
  streak: number;
  is_me: boolean;
  is_public: boolean;
};

export type WalletEntry = {
  id: string;
  day: string;
  amount_cents: number;
  source: "vente" | "client" | "freelance" | "contenu" | "autre";
  label: string;
  status: "declared" | "proven" | "audit_pending" | "rejected";
  has_proof: boolean;
};

export type Wallet = {
  enabled: boolean;
  proven_cents: number;
  declared_cents: number;
  month_cents: number;
  arc_cents: number;
  points_today: number;
  points_cap: number;
  goal: { title: string; target: number | null; unit: string | null } | null;
  months: { month: string; proven_cents: number; declared_cents: number }[];
  entries: WalletEntry[];
};

export type SquadView = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  is_official: boolean;
  start_date: string | null;
  category: Category | null;
  members: number;
  is_member: boolean;
  is_owner: boolean;
  code: string | null;
};

export type PublicPlans = {
  arc: { once: number };
  pro: { month: number; year: number };
  fondateur: { lifetime: number; limit: number; sold: number };
};

/** Résultat des fonctions de session (start_proof_session, start_challenge_session). */
export type StartedSession = {
  id: string;
  nonce: string;
  kind: "session" | "reps" | "reveil";
  minutes: number | null;
  started_at: string;
  server_now: string;
  code: string | null;
  target: Target & ChallengeRule;
};

/** Aperçu des principes pour un visiteur (preview_principles). */
export type PreviewPrinciple = {
  code: string;
  pillar: Pillar;
  if_text: string;
  then_text: string;
  proof_type: ProofType;
  days: number[];
  why: string;
  source: string;
  difficulty: number;
};
export type Preview = { principles: PreviewPrinciple[]; templates: number };

/** Preuve sociale : chiffres réels de la base (social_proof). */
export type SocialProof = {
  joueurs: number;
  arcs_en_cours: number;
  verts_aujourdhui: number;
  arcs_tenus: number;
  preuves_7j: number;
  minutes_focus_7j: number;
  templates: number;
  joueurs_en_forme: { pseudo: string; avatar_path: string | null; level: number; streak: number; ovr: number }[];
};

export type GradeEntry = {
  id: string;
  day: string;
  subject: string;
  score: number;
  out_of: number;
  coefficient: number;
  status: "declared" | "proven";
  has_proof: boolean;
};

export type Grades = {
  enabled: boolean;
  points_today: number;
  points_cap: number;
  average: number | null;
  count: number;
  subjects: { subject: string; average: number; count: number }[];
  weeks: { week: string; average: number }[];
  entries: GradeEntry[];
};
