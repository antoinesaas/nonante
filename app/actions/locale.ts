"use server";

import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

/** Choix de langue : gardé un an dans un cookie, et sur le profil (emails, notifications). */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  const { supabase, user } = await getUser();
  if (user) await supabase.rpc("set_my_locale", { p_locale: locale });
}
