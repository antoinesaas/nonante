import { ActivityRings } from "@/components/ActivityRings";
import { addDays } from "@/lib/answers";
import type { Locale } from "@/lib/i18n/config";
import { fmt, formatDay, formatNumber } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { formatDuration, mathLevelName, mathText } from "@/lib/math";
import type { MentalMath } from "@/lib/types";

const DAYS = 14;

/** Bonnes réponses par jour sur 14 jours : une barre par jour, un point quand il n'y a pas eu de calcul. */
function MathChart({ days, aria, locale }: { days: { day: string; correct: number; total: number }[]; aria: string; locale: Locale }) {
  const W = 400;
  const H = 140;
  const top = 18;
  const base = H - 22;
  const step = W / days.length;
  const bar = Math.min(16, step * 0.55);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={aria}>
      <defs>
        <linearGradient id="math-bar" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#1f8bff" />
          <stop offset="100%" stopColor="#6fe3ff" />
        </linearGradient>
      </defs>
      {days.map((d, i) => {
        const x = i * step + step / 2;
        const h = d.total ? (d.correct / d.total) * (base - top) : 0;
        return (
          <g key={d.day}>
            {d.total ? (
              <>
                <rect x={x - bar / 2} y={base - Math.max(h, 4)} width={bar} height={Math.max(h, 4)} rx={bar / 2} fill="url(#math-bar)" fillOpacity={d.correct === d.total ? 1 : 0.55} />
                <text x={x} y={base - Math.max(h, 4) - 5} textAnchor="middle" fontSize="11" fill="var(--color-paper)">
                  {d.correct}
                </text>
              </>
            ) : (
              <circle cx={x} cy={base - 2} r="2" fill="var(--color-mute)" fillOpacity="0.5" />
            )}
            <text x={x} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-mute)">
              {formatNumber(Number(d.day.slice(8)), locale)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Suivi du calcul mental du réveil : réussite en anneau, temps moyen, record, graphique sur 14 jours, jour par jour. */
export function MentalMathPanel({ data, today, m, locale }: { data: MentalMath; today: string; m: Messages; locale: Locale }) {
  const t = m.app.math;
  const units = m.common.units;
  const byDay = new Map<string, { correct: number; total: number }>();
  for (const e of data.entries) {
    const d = byDay.get(e.day) ?? { correct: 0, total: 0 };
    byDay.set(e.day, { correct: d.correct + e.correct, total: d.total + e.total });
  }
  const chart = Array.from({ length: DAYS }, (_, i) => {
    const day = addDays(today, i - DAYS + 1);
    const d = byDay.get(day);
    return { day, correct: d?.correct ?? 0, total: d?.total ?? 0 };
  });
  const rate = data.total ? Math.round((100 * data.correct) / data.total) : null;

  return (
    <section id="calcul" className="card mt-6 scroll-mt-24 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-[20px]">{t.section}</h2>
          <p className="text-[12px] text-mute">{fmt(t.level, { n: data.level, name: t.levelNames[mathLevelName(data.level)] })}</p>
        </div>
        <ActivityRings rings={[{ value: data.correct, max: Math.max(1, data.total), tone: "sky" }]} size={52} stroke={7} label="" />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white/[0.04] p-3">
          <dt className="text-[11px] text-mute">{t.accuracy}</dt>
          <dd className="mt-0.5 font-display text-[19px] tabular-nums">{rate === null ? "—" : `${formatNumber(rate, locale)} %`}</dd>
        </div>
        <div className="rounded-2xl bg-white/[0.04] p-3">
          <dt className="text-[11px] text-mute">{t.avgTime}</dt>
          <dd className="mt-0.5 font-display text-[19px] tabular-nums">{data.avg_ms !== null ? formatDuration(data.avg_ms, units) : "—"}</dd>
        </div>
        <div className="rounded-2xl bg-white/[0.04] p-3">
          <dt className="text-[11px] text-mute">{t.bestTime}</dt>
          <dd className="mt-0.5 font-display text-[19px] tabular-nums">{data.best_ms !== null ? formatDuration(data.best_ms, units) : "—"}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[12px] text-mute">
        {rate === null ? t.empty : fmt(t.summary, { quizzes: data.quizzes, correct: data.correct, total: data.total, points: data.points }, locale)}
      </p>
      <p className="mt-1 text-[12px] text-mute">{t.progress}</p>

      {data.entries.length ? (
        <>
          <div className="mt-4">
            <MathChart days={chart} aria={t.chartAria} locale={locale} />
          </div>
          <details className="group mt-2">
            <summary className="press flex cursor-pointer list-none items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 text-[15px] [&::-webkit-details-marker]:hidden">
              {t.byDay}
              <svg viewBox="0 0 16 16" className="size-3.5 text-mute transition-transform duration-300 group-open:rotate-90" aria-hidden="true">
                <path d="M6 3.5 L10.5 8 L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <ul className="mt-2 space-y-2">
              {data.entries.map((e) => (
                <li key={e.id} className="animate-in rounded-2xl bg-white/[0.03] p-4">
                  <p className="flex items-baseline justify-between gap-4 text-sm">
                    <span>{formatDay(e.day, locale, { weekday: true, year: false })}</span>
                    <span className="flex items-baseline gap-2 tabular-nums">
                      {e.duration_ms !== null ? <span className="text-xs text-mute">{formatDuration(e.duration_ms, units)}</span> : null}
                      <span className="font-display text-[17px]">
                        {e.correct}
                        <span className="text-xs text-mute">/{e.total}</span>
                      </span>
                      <span className={`text-xs ${e.points ? "text-ok" : "text-mute"}`}>+{e.points}</span>
                    </span>
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-mute">
                    {e.questions.map((q, i) => (
                      <li key={i} className="flex justify-between gap-4 tabular-nums">
                        <span>
                          {mathText(q, locale, t.percentOf)} ={" "}
                          <span className={q.correct ? "text-paper" : "text-ko line-through"}>{formatNumber(q.given, locale)}</span>
                        </span>
                        <span className={q.correct ? "text-ok" : ""}>{q.correct ? "✓" : fmt(t.right, { n: formatNumber(q.answer, locale) })}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </section>
  );
}
