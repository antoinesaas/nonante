import { fmt, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { MathQuestion } from "@/lib/types";

/** « 47 + 38 », « 25 % de 80 », « 17² »… dans la langue du joueur. */
export function mathText(q: MathQuestion, locale: Locale, percentOf: string): string {
  const a = formatNumber(q.a, locale);
  const b = formatNumber(q.b, locale);
  switch (q.op) {
    case "+":
      return `${a} + ${b}`;
    case "-":
      return `${a} − ${b}`;
    case "x":
      return `${a} × ${b}`;
    case "/":
      return `${a} ÷ ${b}`;
    case "%":
      return fmt(percentOf, { a, b });
    case "sq":
      return `${a}²`;
  }
}

/** Réglages du niveau de départ (v15) : selon les études, ou choisi. */
export const MATH_MODES = ["auto", "debutant", "intermediaire", "avance", "expert"] as const;
export type MathMode = (typeof MATH_MODES)[number];

/** Nom d'un niveau de 1 à 10 : débutant 1-2, intermédiaire 3-4, avancé 5-7, expert 8-10. */
export function mathLevelName(level: number): Exclude<MathMode, "auto"> {
  return level <= 2 ? "debutant" : level <= 4 ? "intermediaire" : level <= 7 ? "avance" : "expert";
}

/** 42 300 ms → « 42 s » ; 95 000 ms → « 1 min 35 s ». */
export function formatDuration(ms: number, units: { min: string; s: string }): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(total / 60);
  const s = total % 60;
  return min ? `${min} ${units.min} ${String(s).padStart(2, "0")} ${units.s}` : `${s} ${units.s}`;
}
