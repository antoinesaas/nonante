// Formes des objets JSON renvoyés par les fonctions Postgres (my_dashboard, day_detail, my_profile…).

export type ProofType = "session" | "reps" | "reveil" | "photo" | "lien" | "declaratif";
export type DayStatus = "green" | "red" | "white" | "future" | "today" | "pending" | "none";
export type Category = "etudes" | "business" | "mixte";

export type Target = {
  minutes?: number;
  before?: string;
  after?: string;
  exercise?: "pushup" | "squat";
  reps?: number;
  domains?: string[];
};

export type PrincipleView = {
  id: string;
  position: number;
  if_text: string;
  then_text: string;
  proof_type: ProofType;
  difficulty: number;
  max_difficulty: number;
  value: number;
  days: number[];
  target: Target;
  source: "template" | "custom";
  scheduled_today: boolean;
  validation: { status: "valid" | "audit_pending" | "rejected"; strength: "forte" | "faible"; points: number; proof_type: ProofType } | null;
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

export type Dashboard = {
  profile: { pseudo: string; is_admin: boolean; is_public: boolean; referral_code: string | null; referral_sales: number } | null;
  enrollment: {
    id: string;
    status: "pending_payment" | "active" | "abandoned" | "completed" | "failed";
    level: number;
    level_seen: number;
    category: Category;
    goal_title: string;
    started_on: string | null;
    stake_status: "none" | "held" | "refunded" | "forfeited";
    stake_cents: number;
    loyalty_code: string | null;
  } | null;
  cohort?: { id: string; name: string; start_date: string; end_date: string; price_cents: number; early_price_cents: number };
  state?: "pending" | "before" | "running" | "ended" | "abandoned" | "completed" | "failed";
  today?: string;
  day_number?: number | null;
  points?: number;
  week_points?: number;
  rank?: number | null;
  total?: number | null;
  principles?: PrincipleView[];
  calendar?: CalendarDay[];
  challenge?: ChallengeView | null;
  audits?: AuditView[];
  running_session?: { id: string; kind: ProofType; principle_id: string | null; assignment_id: string | null } | null;
  unseen_achievements?: number;
  level_up?: boolean;
};

export type DayDetail = {
  day: string;
  status: "green" | "red" | "white" | null;
  points: number;
  principles: {
    then_text: string;
    proof_type: ProofType;
    validation: { status: string; strength: string; points: number } | null;
    miss: { points: number; streak: number; white: boolean } | null;
  }[];
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

export type MyProfile = {
  pseudo: string;
  email: string;
  is_public: boolean;
  is_admin: boolean;
  email_reminders: boolean;
  profile_art_slug: string;
  refused_proofs: number;
  referral_code: string | null;
  referral_ready: boolean;
  referral_sales: number;
  arts: string[];
  push_subscriptions: number;
  level: number | null;
  cohort_id: string | null;
  enrollment_status: string | null;
  loyalty_code: string | null;
  achievements: AchievementView[];
};

export type PublicProfile = {
  pseudo: string;
  art: string;
  refused_proofs: number;
  level: number | null;
  status: string | null;
  category: Category | null;
  goal: string | null;
  cohort: string | null;
  day_number: number | null;
  points: number | null;
  rank: number | null;
  total: number | null;
  calendar: CalendarDay[];
  achievements: { code: string; title: string; description: string; art_slug: string | null; unlocked_at: string }[];
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
