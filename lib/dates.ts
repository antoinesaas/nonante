// Toutes les dates métier sont en heure de Paris, calculées côté serveur.
export const TIMEZONE = "Europe/Paris";

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function todayParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Décalage de Paris par rapport à UTC (en ms) à un instant donné. */
function parisOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - at.getTime();
}

/** Instant de minuit (heure de Paris) pour une date AAAA-MM-JJ. */
export function parisMidnight(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d);
  // Les changements d'heure ont lieu à 2 h ou 3 h : le décalage à minuit est le même.
  return new Date(utcGuess - parisOffsetMs(new Date(utcGuess)));
}

/** « Du 1er janvier au 31 mars 2027 », ou « Du 5 octobre 2026 au 2 janvier 2027 » si les années diffèrent. */
export function formatRangeFr(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `Du ${formatDayFr(start, { year: !sameYear })} au ${formatDayFr(end)}`;
}

/** « 1er janvier 2027 », « vendredi 1er janvier 2027 »… */
export function formatDayFr(
  date: string,
  { weekday = false, year = true }: { weekday?: boolean; year?: boolean } = {},
): string {
  const [y, m, d] = date.split("-").map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(noon);
  const day = d === 1 ? "1er" : String(d);
  const prefix = weekday
    ? `${new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }).format(noon)} `
    : "";
  return `${prefix}${day} ${month}${year ? ` ${y}` : ""}`;
}
