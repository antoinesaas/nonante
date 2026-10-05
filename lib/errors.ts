type DbError = { code?: string; message: string } | null | undefined;

/**
 * Message à montrer à l'utilisateur. Les fonctions Postgres lèvent des messages déjà rédigés
 * (code P0001) ; tout le reste devient un message générique, sans détail technique.
 */
export function userMessage(error: DbError, fallback = "Une erreur est survenue. Réessaie dans un instant."): string {
  if (!error) return fallback;
  if (error.code === "P0001") return error.message;
  if (error.code === "23505") return "C'est déjà fait.";
  if (error.code === "42501") return "Action non autorisée.";
  return fallback;
}

export type ActionResult = { ok: boolean; message: string | null };

export const idle: ActionResult = { ok: false, message: null };
