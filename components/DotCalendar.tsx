"use client";

import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { ARC_DAYS } from "@/lib/rules";
import type { DayStatus } from "@/lib/types";

export type DayState = DayStatus;

// Petits carrés arrondis : couleur pleine pour un jour clos, gris pour la suite, aujourd'hui cerclé.
const CELL: Record<DayStatus, string> = {
  green: "bg-ok",
  red: "bg-ko",
  white: "bg-paper/85",
  joker: "bg-violet",
  future: "bg-white/[0.06]",
  today: "bg-white/[0.12] ring-2 ring-paper ring-offset-2 ring-offset-ink animate-breathe",
  pending: "bg-white/[0.1]",
  none: "bg-white/[0.04]",
};

export function Dot({ state, today = false, className = "" }: { state: DayStatus; today?: boolean; className?: string }) {
  const ring = today && state !== "today" ? " ring-2 ring-paper ring-offset-2 ring-offset-ink" : "";
  return <span className={`block aspect-square w-full rounded-[0.3rem] transition-transform duration-200 ${CELL[state]}${ring} ${className}`} />;
}

export const calendarGrid = "grid w-full grid-cols-10 gap-[0.4rem] sm:gap-2";

/** Le calendrier de l'arc : 90 carrés, 10 colonnes × 9 lignes. */
export function DotCalendar({ days, today }: { days: DayStatus[]; today?: number }) {
  const { m } = useI18n();
  const cells = Array.from({ length: ARC_DAYS }, (_, i) => days[i] ?? "future");
  return (
    <ol className={calendarGrid}>
      {cells.map((state, i) => (
        <li key={i} aria-label={fmt(m.game.calendar.dotAria, { n: i + 1, status: m.game.dayStatus[i === today ? "today" : state] })}>
          <Dot state={state} today={i === today} />
        </li>
      ))}
    </ol>
  );
}

/** Légende minimale : quatre couleurs, une ligne. */
export function CalendarLegend() {
  const { m } = useI18n();
  return (
    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-mute">
      {(["green", "red", "white", "joker"] as const).map((state) => (
        <li key={state} className="flex items-center gap-1.5">
          <span className={`block size-2.5 rounded-[3px] ${CELL[state]}`} />
          {m.game.dayStatus[state]}
        </li>
      ))}
    </ul>
  );
}
