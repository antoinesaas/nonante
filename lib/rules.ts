// Règles du jeu (§6). Toutes les valeurs de points vivent ici.
// Les calculs eux-mêmes se font côté serveur, dans Postgres (phase 4).

export const ARC_DAYS = 90;

/** Valeur d'un principe selon sa difficulté. */
export const PRINCIPLE_VALUE = { 1: 10, 2: 20, 3: 30 } as const;

/** Part des points gagnés selon la force de la preuve. */
export const PROOF_STRENGTH_RATIO = { forte: 1, faible: 0.5 } as const;

/** Multiplicateur de pénalité d'un principe raté, selon le nombre de jours d'affilée. */
export const MISS_MULTIPLIER = { first: 1, second: 2, thirdOrMore: 3 } as const;

/** Jour blanc : chaque principe du jour compte − 2 × valeur. */
export const WHITE_DAY_MULTIPLIER = 2;

export const BROKEN_SESSION_PENALTY = -5;

/** Contrôle refusé ou non envoyé : − 3 × valeur. */
export const FAILED_AUDIT_MULTIPLIER = 3;

export const CHALLENGE_POINTS = {
  epreuve: { 1: { done: 100, failed: -50 }, 2: { done: 200, failed: -100 }, 3: { done: 300, failed: -150 } },
  piege: { done: 150, failed: -150 },
} as const;

export const PERFECT_WEEK_BONUS = 50;
export const ARC_COMPLETED_BONUS = 500;

/** Arc tenu : au moins 75 jours verts et jamais plus de 3 jours non verts d'affilée. */
export const ARC_COMPLETION = { minGreenDays: 75, maxConsecutiveNonGreen: 3 } as const;

/** Abandon : 7 jours blancs d'affilée. */
export const ABANDON_AFTER_WHITE_DAYS = 7;
