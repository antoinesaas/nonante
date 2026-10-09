import type { Locale } from "@/lib/i18n/config";
import { fmt, formatNumber, formatTime } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import type { Category, ProofType, Target } from "@/lib/types";

// Libellés du jeu dans la langue de l'utilisateur.

/** {1..7} → « tous les jours », « du lundi au vendredi », « samedi et dimanche »… */
export function daysLabel(days: number[], m: Messages): string {
  const d = m.game.days;
  const sorted = [...days].sort((a, b) => a - b);
  if (!sorted.length) return d.none;
  if (sorted.length === 7) return d.every;
  if (sorted.join() === "1,2,3,4,5") return d.weekdays;
  if (sorted.join() === "6,7") return d.weekend;
  const names = sorted.map((n) => d.names[n - 1]);
  if (names.length === 1) return fmt(d.single, { day: names[0] });
  return `${names.slice(0, -1).join(", ")} ${d.and} ${names[names.length - 1]}`;
}

/** Précision sous un principe : « 50 min · avant 12 h », « 20 pompes »… */
export function targetHint(proof: ProofType, target: Target, m: Messages, locale: Locale): string | null {
  const t = m.game.target;
  const parts: string[] = [];
  if (proof === "session" && target.minutes) parts.push(fmt(t.minutes, { n: target.minutes }, locale));
  if (proof === "reps" && target.reps) parts.push(fmt(target.exercise === "squat" ? t.squats : t.pushups, { n: target.reps }, locale));
  if (target.before) parts.push(fmt(proof === "reveil" ? t.wakeBefore : t.finishedBefore, { time: formatTime(target.before, locale) }));
  if (target.after) parts.push(fmt(t.after, { time: formatTime(target.after, locale) }));
  if (target.count) parts.push(`${formatNumber(target.count, locale)}${target.unit ? ` ${target.unit}` : ""}`);
  return parts.length ? parts.join(" · ") : null;
}

const TITLE_LEVELS: [number, keyof Messages["game"]["titles"]][] = [
  [40, "legende"],
  [30, "inarretable"],
  [20, "redoutable"],
  [15, "discipline"],
  [10, "constant"],
  [5, "initie"],
  [1, "recrue"],
];

export function titleFor(level: number, m: Messages): string {
  const key = TITLE_LEVELS.find(([min]) => level >= min)?.[1] ?? "recrue";
  return m.game.titles[key];
}

/** Prochain titre et niveau requis, ou null au sommet. */
export function nextTitle(level: number, m: Messages): { level: number; title: string } | null {
  const next = [...TITLE_LEVELS].reverse().find(([min]) => min > level);
  return next ? { level: next[0], title: m.game.titles[next[1]] } : null;
}

/** Une citation par jour, la même pour tout le monde (date au format AAAA-MM-JJ). */
/**
 * Citation du jour, la même pour tout le monde, nouvelle chaque jour à minuit (Paris). La liste est rangée par auteur :
 * on la parcourt par sauts de 17 (premier avec 37, donc chaque citation revient une fois par cycle), pour que deux
 * jours de suite ne tombent pas sur le même auteur.
 */
export function quoteOfDay(date: string, m: Messages) {
  const [y, mo, d] = date.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(y, mo - 1, d) / 86_400_000);
  const quotes = m.game.quotes;
  const n = quotes.length;
  return quotes[(((dayNumber * 17) % n) + n) % n];
}

/** « alors 20 pompes. » / « then 20 push-ups. » → « 20 pompes » */
export function bareThen(text: string): string {
  return text.replace(/^(alors|then|dann|entonces) /i, "").replace(/\.$/, "");
}

/** Nom d'une escouade : les parties officielles (une par catégorie) sont traduites, les autres gardent le leur. */
export function squadName(s: { name: string; is_official?: boolean; category?: Category | null }, m: Messages): string {
  return s.is_official && s.category ? m.app.squads.parties[s.category] : s.name;
}
