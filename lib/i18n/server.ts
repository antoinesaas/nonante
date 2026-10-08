import "server-only";
import { cookies, headers } from "next/headers";
import { detectLocale, isLocale, type Locale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/** Langue de la requête : choix enregistré (cookie), sinon langue du navigateur, sinon pays. */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  const h = await headers();
  return detectLocale(h.get("accept-language"), h.get("x-vercel-ip-country"));
}

/** Pays de la requête (en-tête de Vercel), ou null en local. */
export async function getCountry(): Promise<string | null> {
  const c = (await headers()).get("x-vercel-ip-country");
  return c && /^[A-Z]{2}$/.test(c) ? c : null;
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, m: getMessages(locale) };
}
