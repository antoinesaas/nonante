// Règles du jeu. Toutes les valeurs de points vivent ici et dans les fonctions Postgres
// (supabase/migrations/*_v2_logic.sql) : à garder synchronisées. Les calculs se font côté serveur.

export const ARC_DAYS = 90;

/** Valeur d'un principe selon sa difficulté (calculée par le serveur). */
export const PRINCIPLE_VALUE = { 1: 10, 2: 20, 3: 30 } as const;

/** Part des points gagnés selon la force de la preuve. */
export const PROOF_STRENGTH_RATIO = { forte: 1, faible: 0.5 } as const;

/** Principe raté (jour blanc compris) : on perd sa valeur, rien de plus (v10). */
export const MISS_MULTIPLIER = 1;

/** Total à −500 ou moins : il repart à 0 (ligne « reset », hors XP et hors points de la semaine, du mois ou du jour). */
export const POINTS_FLOOR = -500;

/** Réveil : cinq calculs de tête selon le niveau d'études, chronométrés ; +5 par bonne réponse, une erreur ne coûte rien. */
/** Sessions bonus (v14) : un minuteur déjà validé se refait, 10 × difficulté, 3 au plus par jour. */
export const SESSION_BONUS_MAX = 3;
/** Difficulté d'une session selon sa durée (comme `_difficulty` en SQL). */
export const sessionDifficulty = (minutes: number) => (minutes <= 25 ? 1 : minutes <= 50 ? 2 : 3);

/** Difficulté des répétitions (comme `_difficulty` en SQL) : pompes ≤ 15/≤ 40/plus, squats ≤ 25/≤ 60/plus. */
export const repsDifficulty = (exercise: "pushup" | "squat", reps: number) =>
  exercise === "squat" ? (reps <= 25 ? 1 : reps <= 60 ? 2 : 3) : reps <= 15 ? 1 : reps <= 40 ? 2 : 3;

export const MENTAL_MATH = { questions: 5, pointsPerRight: 5 } as const;
export const BROKEN_SESSION_PENALTY = -5;
/** Contrôle refusé ou non envoyé : − 3 × valeur ; revenu refusé : − 30. */
export const FAILED_AUDIT_MULTIPLIER = 3;
export const FAILED_WALLET_AUDIT = -30;
/** Revenu pendant l'arc : 10 + 1 par tranche de 10 € (50 au plus), la moitié sans capture ; 50 points par jour au plus. */
export const WALLET_POINTS = { base: 10, perTenEuros: 1, max: 50, dailyCap: 50 } as const;
/** Note pendant l'arc, ramenée sur 20 : 10 → 5, 12 → 10, 14 → 15, 16 → 20, la moitié sans preuve ; 30 par jour au plus. */
export const GRADE_POINTS = { tiers: [[16, 20], [14, 15], [12, 10], [10, 5]], dailyCap: 30 } as const;

export const CHALLENGE_POINTS = {
  epreuve: { 1: { done: 100, failed: -50 }, 2: { done: 200, failed: -100 }, 3: { done: 300, failed: -150 } },
  piege: { done: 150, failed: -150 },
} as const;

export const PERFECT_WEEK_BONUS = 50;
export const ARC_COMPLETED_BONUS = 500;

/** Arc tenu : jours verts + jokers ≥ 75 et jamais plus de 3 jours non verts d'affilée (hors jokers). */
export const ARC_COMPLETION = { minGreenDays: 75, maxConsecutiveNonGreen: 3 } as const;

/** Abandon : 7 jours blancs d'affilée. */
export const ABANDON_AFTER_WHITE_DAYS = 7;

/** Une stat de pilier vaut 99 quand le pilier rapporte 600 points sur 30 jours (20 par jour). */
export const STAT_FULL_XP = 600;

/** Niveau = ⌊√(XP / 50)⌋ + 1. */
export function levelFor(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(xp, 0) / 50)) + 1;
}
