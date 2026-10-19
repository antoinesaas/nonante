"use client";

import { useState, useTransition } from "react";
import { getDayDetail } from "@/app/actions/proofs";
import { calendarGrid, Dot } from "@/components/DotCalendar";
import { useI18n } from "@/components/I18nProvider";
import { Sheet } from "@/components/Sheet";
import { fmt, formatDay, signed } from "@/lib/i18n/format";
import type { CalendarDay, DayDetail } from "@/lib/types";

/** Calendrier de l'arc : un toucher sur un carré ouvre le détail du jour dans une feuille. */
export function CalendarInteractive({ days }: { days: CalendarDay[] }) {
  const { m, locale } = useI18n();
  const c = m.game.calendar;
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [pending, startTransition] = useTransition();

  function open(index: number) {
    const day = days[index];
    setSelected(index);
    setDetail(null);
    if (["green", "red", "white", "joker", "today", "pending"].includes(day.status)) {
      startTransition(async () => setDetail(await getDayDetail(day.day)));
    }
  }

  const current = selected !== null ? days[selected] : null;

  return (
    <div>
      <ol className={calendarGrid}>
        {days.map((day, i) => (
          <li key={day.day}>
            <button
              type="button"
              onClick={() => open(i)}
              aria-label={fmt(c.dayAria, { n: i + 1, date: formatDay(day.day, locale, { year: false }), status: m.game.dayStatus[day.status] })}
              aria-pressed={selected === i}
              className="block w-full active:scale-90 transition-transform"
            >
              <Dot state={day.status} />
            </button>
          </li>
        ))}
      </ol>

      <Sheet
        open={current !== null}
        onClose={() => setSelected(null)}
        title={current ? fmt(c.day, { n: selected! + 1, date: formatDay(current.day, locale, { weekday: true, year: false }) }) : ""}
      >
        {current ? (
          <div className="pb-2 text-[15px]" aria-live="polite">
            <p className="flex items-center gap-2 text-mute">
              <span className="block size-3 shrink-0">
                <Dot state={current.status} />
              </span>
              {m.game.dayStatus[current.status]}
            </p>
            {pending ? <span className="skeleton mt-5 block h-24 w-full rounded-2xl" /> : null}
            {detail ? (
              <>
                <ul className="grouped mt-5">
                  {detail.principles.map((p, i) => (
                    <li key={i} className="flex items-start justify-between gap-4 px-4 py-3">
                      <span className={p.validation && p.validation.status !== "rejected" ? "" : "text-mute"}>
                      {p.then_text}
                      {p.bonus ? <span className="mt-0.5 block text-[13px] text-mute">{fmt(p.bonus.count > 1 ? c.bonusPlural : c.bonus, { n: p.bonus.count, p: signed(p.bonus.points) })}</span> : null}
                    </span>
                      <span className={`shrink-0 tabular-nums ${p.validation && p.validation.status !== "rejected" ? "text-ok" : p.miss ? "text-ko" : "text-mute"}`}>
                        {p.validation ? (p.validation.status === "rejected" ? c.refused : signed(p.validation.points)) : p.miss ? signed(p.miss.points) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex justify-between px-1 font-medium">
                  {c.total} <span className="tabular-nums">{signed(detail.points)}</span>
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
