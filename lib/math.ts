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
