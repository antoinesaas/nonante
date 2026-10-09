// Règles du jeu. Toutes les valeurs de points vivent ici et dans les fonctions Postgres
// (supabase/migrations/*_v2_logic.sql) : à garder synchronisées. Les calculs se font côté serveur.

export const ARC_DAYS = 90;

/** Valeur d'un principe selon sa difficulté (calculée par le serveur). */
export const PRINCIPLE_VALUE = { 1: 10, 2: 20, 3: 30 } as const;

/** Part des points gagnés selon la force de la preuve. */
export const PROOF_STRENGTH_RATIO = { forte: 1, faible: 0.5 } as const;

/** Multiplicateur de pénalité d'un principe raté, selon le nombre de jours d'affilée. */
export const MISS_MULTIPLIER = { first: 1, second: 2, thirdOrMore: 3 } as const;

/** Jour blanc : chaque principe du jour compte − 2 × valeur. */
export const WHITE_DAY_MULTIPLIER = 2;
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
