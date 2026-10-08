// Langues de l'app. Le français est la langue source ; les autres se choisissent dans le pied de page
// ou le profil, et sont devinées au premier passage (langue du téléphone, puis pays).

export const LOCALES = ["fr", "en", "de", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "nonante_lang";

export const LOCALE_LABEL: Record<Locale, string> = { fr: "Français", en: "English", de: "Deutsch", es: "Español" };

/** Étiquettes Intl (dates, nombres, monnaie). */
export const INTL: Record<Locale, string> = { fr: "fr-FR", en: "en-GB", de: "de-DE", es: "es-ES" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// Pays → langue, quand la langue du navigateur n'est pas l'une des nôtres.
const FR = ["FR", "BE", "LU", "MC", "MA", "DZ", "TN", "SN", "CI", "CM", "ML", "BF", "NE", "TG", "BJ", "GA", "CG", "CD", "MG", "HT", "RE", "GP", "MQ", "GF", "NC", "PF"];
const DE = ["DE", "AT", "LI"];
const ES = ["ES", "MX", "AR", "CO", "CL", "PE", "VE", "EC", "GT", "CU", "BO", "DO", "HN", "PY", "SV", "NI", "CR", "PA", "UY", "PR"];

export function localeForCountry(country: string | null | undefined): Locale | null {
  const c = (country ?? "").toUpperCase();
  if (FR.includes(c)) return "fr";
  if (DE.includes(c)) return "de";
  if (ES.includes(c)) return "es";
  return c ? "en" : null;
}

/** Langue du navigateur (Accept-Language), puis pays (en-tête de Vercel), sinon français. */
export function detectLocale(acceptLanguage: string | null, country: string | null): Locale {
  const wanted = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { base: (tag ?? "").slice(0, 2).toLowerCase(), q: q ? Number(q.split("=")[1]) || 0 : 1 };
    })
    .filter((x) => x.base)
    .sort((a, b) => b.q - a.q);
  for (const { base } of wanted) if (isLocale(base)) return base;
  return localeForCountry(country) ?? DEFAULT_LOCALE;
}
