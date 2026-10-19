"use client";

import { useState, useTransition } from "react";
import { getDayDetail } from "@/app/actions/proofs";
import { ActivityRings } from "@/components/ActivityRings";
import { useI18n } from "@/components/I18nProvider";
import { Sheet } from "@/components/Sheet";
import { fmt, formatDay, signed } from "@/lib/i18n/format";
import type { DayDetail, WeekDay } from "@/lib/types";

/** Un jour de l'historique : mini-anneau et numéro ; un toucher ouvre le détail dans une feuille. */
export function HistoryDay({ day }: { day: WeekDay }) {
  const { m, locale } = useI18n();
  const c = m.game.calendar;
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [pending, startTransition] = useTransition();
  const full = day.status === "green" || day.joker || (day.due > 0 && day.done >= day.due);
  const value = full ? 1 : day.due ? day.done / day.due : 0;

  function show() {
    setOpen(true);
    setDetail(null);
    startTransition(async () => setDetail(await getDayDetail(day.day)));
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label={fmt(m.app.today.weekDayAria, { date: formatDay(day.day, locale, { weekday: true, year: false }), done: day.done, due: day.due })}
        className="flex w-full flex-col items-center gap-1 transition-transform active:scale-90"
      >
        <ActivityRings rings={[{ value, max: 1, tone: day.joker ? "violet" : day.status === "red" || day.status === "white" ? "amber" : "rose" }]} size={32} stroke={5} label="" />
        <span className="text-[11px] text-mute tabular-nums">{Number(day.day.slice(8))}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={formatDay(day.day, locale, { weekday: true, year: false })}>
        <div className="pb-4 text-[15px]">
          <p className="text-mute">{day.status ? m.game.dayStatus[day.status] : m.game.dayStatus.today}</p>
          {pending || !detail ? <span className="skeleton mt-4 block h-24 w-full rounded-2xl" /> : null}
          {detail ? (
            <>
              <ul className="grouped mt-4">
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
      </Sheet>
    </>
  );
}
