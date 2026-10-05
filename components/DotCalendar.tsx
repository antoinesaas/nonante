import { ARC_DAYS } from "@/lib/rules";

export type DayState = "green" | "red" | "white" | "future";

const DOT: Record<DayState, string> = {
  green: "bg-ok",
  red: "bg-ko",
  white: "bg-paper",
  future: "border border-mute/50",
};

const LABEL: Record<DayState, string> = {
  green: "réussi",
  red: "raté",
  white: "absent",
  future: "à venir",
};

export function Dot({ state, today = false }: { state: DayState; today?: boolean }) {
  const ring = today ? " ring-1 ring-paper ring-offset-[3px] ring-offset-ink" : "";
  return <span className={`block size-3.5 rounded-full sm:size-4 ${DOT[state]}${ring}`} />;
}

/** Le calendrier de l'arc : 90 points, 10 colonnes × 9 lignes. */
export function DotCalendar({ days, today }: { days: DayState[]; today?: number }) {
  const cells = Array.from({ length: ARC_DAYS }, (_, i) => days[i] ?? "future");
  return (
    <ol className="grid w-fit grid-cols-10 gap-x-3.5 gap-y-3.5 sm:gap-x-5 sm:gap-y-5">
      {cells.map((state, i) => (
        <li key={i} aria-label={`Jour ${i + 1} : ${i === today ? "aujourd'hui" : LABEL[state]}`}>
          <Dot state={state} today={i === today} />
        </li>
      ))}
    </ol>
  );
}
