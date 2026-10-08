import "server-only";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/config";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Langue enregistrée de chaque joueur (emails, notifications envoyés hors requête). */
export async function localesOf(admin: Admin, ids: string[]): Promise<Map<string, Locale>> {
  const map = new Map<string, Locale>();
  if (!ids.length) return map;
  const { data } = await admin.from("profiles").select("id, locale").in("id", [...new Set(ids)]);
  for (const row of data ?? []) map.set(row.id, isLocale(row.locale) ? row.locale : DEFAULT_LOCALE);
  return map;
}

export async function localeOf(admin: Admin, id: string): Promise<Locale> {
  return (await localesOf(admin, [id])).get(id) ?? DEFAULT_LOCALE;
}
