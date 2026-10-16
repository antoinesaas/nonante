import { addDays } from "@/lib/answers";
import type { Locale } from "@/lib/i18n/config";
import { fmt, formatDay, formatNumber } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { mathText } from "@/lib/math";
import type { MentalMath } from "@/lib/types";
import { label } from "@/lib/ui";

const DAYS = 14;

/** Bonnes réponses par jour sur 14 jours : une barre par jour (sur 3), un trait quand il n'y a pas eu de calcul. */
function MathChart({ days, aria, locale }: { days: { day: string; correct: number; total: number }[]; aria: string; locale: Locale }) {
  const W = 400;
  const H = 150;
  const top = 18;
  const base = H - 22;
  const step = W / days.length;
  const bar = Math.min(18, step * 0.55);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={aria}>
      {[1 / 3, 2 / 3, 1].map((r) => (
        <line key={r} x1="0" x2={W} y1={base - r * (base - top)} y2={base - r * (base - top)} stroke="var(--color-line)" strokeDasharray={r === 1 ? undefined : "2 4"} />
      ))}
      <line x1="0" x2={W} y1={base} y2={base} stroke="var(--color-line)" />
      {days.map((d, i) => {
        const x = i * step + step / 2;
        const h = d.total ? (d.correct / d.total) * (base - top) : 0;
        return (
          <g key={d.day}>
            {d.total ? (
              <>
                <rect x={x - bar / 2} y={base - Math.max(h, 2)} width={bar} height={Math.max(h, 2)} fill={d.correct === d.total ? "var(--color-paper)" : "var(--color-mute)"} />
                <text x={x} y={base - Math.max(h, 2) - 5} textAnchor="middle" fontSize="11" fill="var(--color-paper)">
                  {d.correct}
                </text>
              </>
            ) : (
              <line x1={x - bar / 2} x2={x + bar / 2} y1={base - 1} y2={base - 1} stroke="var(--color-mute)" strokeWidth="2" />
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

/** Suivi du calcul mental du réveil : réussite, graphique sur 14 jours, récapitulatif jour par jour. */
export function MentalMathPanel({ data, today, m, locale }: { data: MentalMath; today: string; m: Messages; locale: Locale }) {
  const t = m.app.math;
  const byDay = new Map<string, { correct: number; total: number; points: number }>();
  for (const e of data.entries) {
    const d = byDay.get(e.day) ?? { correct: 0, total: 0, points: 0 };
    byDay.set(e.day, { correct: d.correct + e.correct, total: d.total + e.total, points: d.points + e.points });
  }
  const chart = Array.from({ length: DAYS }, (_, i) => {
    const day = addDays(today, i - DAYS + 1);
    const d = byDay.get(day);
    return { day, correct: d?.correct ?? 0, total: d?.total ?? 0 };
  });
  const rate = data.total ? Math.round((100 * data.correct) / data.total) : null;

  return (
    <section id="calcul" className="mt-10 scroll-mt-24">
      <p className={label}>{t.section}</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="font-serif text-5xl leading-none tabular-nums">{rate === null ? "—" : `${formatNumber(rate, locale)} %`}</p>
        <p className="text-right text-xs text-mute">{t.levels[String(data.level) as "1" | "2" | "3"]}</p>
      </div>
      <p className="mt-2 text-sm text-mute">
        {rate === null ? t.empty : `${t.accuracy} · ${fmt(t.summary, { quizzes: data.quizzes, correct: data.correct, total: data.total, points: data.points }, locale)}`}
      </p>
      <p className="mt-2 text-xs text-mute">{t.sectionText}</p>

      {data.entries.length ? (
        <>
          <div className="mt-6">
            <MathChart days={chart} aria={t.chartAria} locale={locale} />
          </div>
          <h3 className="mt-8 font-serif text-2xl">{t.byDay}</h3>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {data.entries.map((e) => (
              <li key={e.id} className="py-4">
                <p className="flex items-baseline justify-between gap-4 text-sm">
                  <span>{formatDay(e.day, locale, { weekday: true, year: false })}</span>
                  <span className="font-serif text-xl tabular-nums">
                    {e.correct}
                    <span className="text-sm text-mute">/{e.total}</span>
                    <span className={`ml-3 text-sm ${e.points ? "text-ok" : "text-mute"}`}>+{e.points}</span>
                  </span>
                </p>
                <ul className="mt-2 space-y-1 text-xs text-mute">
                  {e.questions.map((q, i) => (
                    <li key={i} className="flex justify-between gap-4 tabular-nums">
                      <span>
                        {mathText(q, locale, t.percentOf)} = <span className={q.correct ? "text-paper" : "text-ko line-through"}>{formatNumber(q.given, locale)}</span>
                      </span>
                      <span className={q.correct ? "text-ok" : ""}>{q.correct ? "✓" : fmt(t.right, { n: formatNumber(q.answer, locale) })}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
