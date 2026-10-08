import { INTL, type Locale } from "@/lib/i18n/config";

// Mise en forme selon la langue : textes à trous, pluriels, dates, heures, nombres, montants.

type Vars = Record<string, string | number | null | undefined>;

/**
 * « Bonjour {name} » → « Bonjour Léa ».
 * Pluriel : « {n|# jour|# jours} » choisit la forme selon la langue (# = le nombre mis en forme).
 */
export function fmt(template: string, vars: Vars = {}, locale: Locale = "fr"): string {
  return template.replace(/\{(\w+)(?:\|([^|}]*)\|([^}]*))?\}/g, (_all, key: string, one?: string, other?: string) => {
    const value = vars[key];
    if (one === undefined || other === undefined) return value === null || value === undefined ? "" : String(value);
    const n = Number(value ?? 0);
    const form = new Intl.PluralRules(INTL[locale]).select(n) === "one" ? one : other;
    return form.replace(/#/g, formatNumber(n, locale));
  });
}

export function formatNumber(n: number, locale: Locale): string {
  return n.toLocaleString(INTL[locale]);
}

/** 1500 → « 15 € » (fr), « €15 » (en)… */
export function formatMoney(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL[locale], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Points : vrai signe moins (−30), sans « + » devant les positifs. */
export function formatPoints(n: number, locale: Locale): string {
  return n < 0 ? `−${formatNumber(Math.abs(n), locale)}` : formatNumber(n, locale);
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

/** « 1er janvier 2027 » (fr), « 1 January 2027 » (en), « 1. Januar 2027 » (de), « 1 de enero de 2027 » (es). */
export function formatDay(
  date: string,
  locale: Locale,
  { weekday = false, year = true }: { weekday?: boolean; year?: boolean } = {},
): string {
  const [y, m, d] = date.split("-").map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  if (locale === "fr") {
    const month = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(noon);
    const day = d === 1 ? "1er" : String(d);
    const prefix = weekday ? `${new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }).format(noon)} ` : "";
    return `${prefix}${day} ${month}${year ? ` ${y}` : ""}`;
  }
  return new Intl.DateTimeFormat(INTL[locale], {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    ...(year ? { year: "numeric" } : {}),
    ...(weekday ? { weekday: "long" } : {}),
  }).format(noon);
}

/** « 06:30 » → « 6 h 30 » (fr), « 6:30 » (en, es), « 6:30 Uhr » (de). */
export function formatTime(hhmm: string, locale: Locale): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (locale === "fr") return `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
  const t = `${h}:${String(m).padStart(2, "0")}`;
  return locale === "de" ? `${t} Uhr` : t;
}

/** Nom d'un pays dans la langue de l'utilisateur (« FR » → « France »). */
export function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([INTL[locale]], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
