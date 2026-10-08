import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import { translateSqlMessage } from "@/lib/i18n/sql-errors";

type DbError = { code?: string; message: string } | null | undefined;

/**
 * Message à montrer à l'utilisateur, dans sa langue. Les fonctions Postgres lèvent des messages déjà rédigés
 * en français (code P0001), traduits ici ; tout le reste devient un message générique, sans détail technique.
 */
export function userMessage(error: DbError, i18n: { m: Messages; locale: Locale }, fallback?: string): string {
  const generic = fallback ?? i18n.m.common.errors.generic;
  if (!error) return generic;
  if (error.code === "P0001") return translateSqlMessage(error.message, i18n.locale) ?? generic;
  if (error.code === "23505") return i18n.m.common.errors.already;
  if (error.code === "42501") return i18n.m.common.errors.forbidden;
  return generic;
}

export type ActionResult = { ok: boolean; message: string | null };

export const idle: ActionResult = { ok: false, message: null };
