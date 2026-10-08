"use client";

import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { ARC_DAYS } from "@/lib/rules";
import type { DayStatus } from "@/lib/types";

export type DayState = DayStatus;

const DOT: Record<DayStatus, string> = {
  green: "bg-ok",
  red: "bg-ko",
  white: "bg-paper",
  joker: "border border-paper bg-[radial-gradient(circle,var(--color-paper)_30%,transparent_32%)]",
  future: "border border-mute/50",
  today: "animate-breathe border border-mute/50 ring-1 ring-paper ring-offset-[3px] ring-offset-ink",
  pending: "border border-mute",
  none: "border border-line",
};

export function Dot({ state, today = false }: { state: DayStatus; today?: boolean }) {
  const ring = today && state !== "today" ? " ring-1 ring-paper ring-offset-[3px] ring-offset-ink" : "";
  return <span className={`block size-3.5 rounded-full sm:size-4 ${DOT[state]}${ring}`} />;
}

export const calendarGrid = "grid w-full grid-cols-[repeat(10,auto)] justify-between gap-y-3.5 sm:gap-y-5";

/** Le calendrier de l'arc : 90 points, 10 colonnes × 9 lignes. */
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

export function CalendarLegend() {
  const { m } = useI18n();
  const items: { state: DayStatus; label: string }[] = (["green", "red", "white", "joker", "future"] as const).map((state) => ({
    state,
    label: m.game.dayStatus[state],
  }));
  return (
    <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-mute">
      {items.map((item) => (
        <li key={item.state} className="flex items-center gap-2">
          <Dot state={item.state} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
