"use client";

import { useState, useTransition } from "react";
import { getDayDetail } from "@/app/actions/proofs";
import { calendarGrid, Dot } from "@/components/DotCalendar";
import { useI18n } from "@/components/I18nProvider";
import { fmt, formatDay, signed } from "@/lib/i18n/format";
import type { CalendarDay, DayDetail } from "@/lib/types";

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
              className="-m-1.5 block p-1.5"
            >
              <Dot state={day.status} />
            </button>
          </li>
        ))}
      </ol>

      {current ? (
        <div className="mt-6 border border-line bg-surface p-4 text-sm" aria-live="polite">
          <div className="flex items-baseline justify-between gap-4">
            <p>
              {fmt(c.day, { n: selected! + 1, date: formatDay(current.day, locale, { weekday: true, year: false }) })}
            </p>
            <button type="button" onClick={() => setSelected(null)} className="text-mute hover:text-paper">
              {m.common.actions.close}
            </button>
          </div>
          <p className="mt-1 text-mute">{m.game.dayStatus[current.status]}</p>
          {pending ? <p className="mt-3 text-mute">{m.common.actions.loading}</p> : null}
          {detail ? (
            <>
              <ul className="mt-4 space-y-2">
                {detail.principles.map((p, i) => (
                  <li key={i} className="flex items-start justify-between gap-4">
                    <span className={p.validation && p.validation.status !== "rejected" ? "" : "text-mute"}>{p.then_text}</span>
                    <span className="shrink-0 tabular-nums">
                      {p.validation
                        ? p.validation.status === "rejected"
                          ? c.refused
                          : signed(p.validation.points)
                        : p.miss
                          ? signed(p.miss.points)
                          : "—"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line pt-3">
                {c.total} <span className="tabular-nums">{signed(detail.points)}</span>
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
