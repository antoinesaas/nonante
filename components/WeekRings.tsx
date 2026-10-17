import { ActivityRings } from "@/components/ActivityRings";
import type { WeekDay } from "@/lib/types";

/**
 * La semaine façon Apple Forme : un mini-anneau par jour (principes prouvés / prévus), la lettre du jour dessous,
 * aujourd'hui souligné. Jour vert ou joker : anneau plein.
 */
export function WeekRings({ days, letters, today, aria }: { days: WeekDay[]; letters: string[]; today: string; aria: (d: WeekDay) => string }) {
  return (
    <ol className="grid grid-cols-7 gap-1">
      {days.map((d, i) => {
        const full = d.status === "green" || d.joker || (d.due > 0 && d.done >= d.due);
        const value = full ? 1 : d.due ? d.done / d.due : 0;
        const isToday = d.day === today;
        return (
          <li key={d.day} className="flex flex-col items-center gap-1.5" aria-label={aria(d)}>
            <span className={`${d.in_arc ? "" : "opacity-30"}`}>
              <ActivityRings rings={[{ value, max: 1, tone: d.joker ? "violet" : "rose" }]} size={34} stroke={5} label="" className="block" />
            </span>
            <span className={`grid size-5 place-items-center rounded-full text-[11px] font-semibold ${isToday ? "bg-paper text-ink" : "text-mute"}`}>{letters[i]}</span>
          </li>
        );
      })}
    </ol>
  );
}
