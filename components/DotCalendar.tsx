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

export const DAY_LABEL: Record<DayStatus, string> = {
  green: "réussi",
  red: "raté",
  white: "absent",
  joker: "joker",
  future: "à venir",
  today: "aujourd'hui",
  pending: "en cours de clôture",
  none: "hors de l'arc",
};

export function Dot({ state, today = false }: { state: DayStatus; today?: boolean }) {
  const ring = today && state !== "today" ? " ring-1 ring-paper ring-offset-[3px] ring-offset-ink" : "";
  return <span className={`block size-3.5 rounded-full sm:size-4 ${DOT[state]}${ring}`} />;
}

export const calendarGrid = "grid w-fit grid-cols-10 gap-x-3.5 gap-y-3.5 sm:gap-x-5 sm:gap-y-5";

/** Le calendrier de l'arc : 90 points, 10 colonnes × 9 lignes. */
export function DotCalendar({ days, today }: { days: DayStatus[]; today?: number }) {
  const cells = Array.from({ length: ARC_DAYS }, (_, i) => days[i] ?? "future");
  return (
    <ol className={calendarGrid}>
      {cells.map((state, i) => (
        <li key={i} aria-label={`Jour ${i + 1} : ${i === today ? "aujourd'hui" : DAY_LABEL[state]}`}>
          <Dot state={state} today={i === today} />
        </li>
      ))}
    </ol>
  );
}

export function CalendarLegend() {
  const items: { state: DayStatus; label: string }[] = [
    { state: "green", label: "réussi" },
    { state: "red", label: "raté" },
    { state: "white", label: "absent" },
    { state: "joker", label: "joker" },
    { state: "future", label: "à venir" },
  ];
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
