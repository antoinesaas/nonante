import type { ActionResult } from "@/lib/errors";

/**
 * Appel d'une action serveur depuis une page restée ouverte pendant une mise en ligne : l'ancienne action
 * n'existe plus et l'appel lève une erreur. On le dit, puis on recharge la page sur la nouvelle version.
 */
export async function guarded(call: () => Promise<ActionResult>, updatedMessage: string): Promise<ActionResult> {
  try {
    return await call();
  } catch {
    setTimeout(() => window.location.reload(), 1800);
    return { ok: false, message: updatedMessage };
  }
}
