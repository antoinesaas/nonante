import type { Metadata } from "next";
import Link from "next/link";
import { Aura } from "@/components/Aura";
import { MentalMathPanel } from "@/components/MentalMathPanel";
import { addDays } from "@/lib/answers";
import { requireUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";
import { fmt, formatDay, formatNumber } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import type { Grades, MentalMath } from "@/lib/types";
import { btnPrimary, label, largeTitle, sectionTitle } from "@/lib/ui";
import { AddGrade, DeleteGradeButton } from "./GradeForms";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.grades.title };
}

const WIDTHS = ["w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]", "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full"];

/**
 * Ta forme, comme sur un bulletin : un sommet par matière, d'autant plus loin du centre que la moyenne est bonne
 * (cercles à 5, 10, 15 et 20 sur 20). SVG pur, la forme s'ouvre à l'apparition.
 */
function SubjectRadar({ subjects, aria, n }: { subjects: Grades["subjects"]; aria: string; n: (v: number) => string }) {
  const W = 400;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2;
  const R = 100;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / subjects.length;
  const at = (i: number, r: number) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  const ring = (v: number) => subjects.map((_, i) => at(i, (v / 20) * R).map((x) => x.toFixed(1)).join(",")).join(" ");
  const shape = subjects.map((s, i) => at(i, (Math.max(0, Math.min(20, Number(s.average))) / 20) * R));
  const short = (name: string) => (name.length > 13 ? `${name.slice(0, 12)}…` : name);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={aria}>
      {[5, 10, 15, 20].map((v) => (
        <polygon key={v} points={ring(v)} fill="none" stroke="var(--color-line)" strokeWidth="1" strokeDasharray={v === 20 ? undefined : "2 4"} />
      ))}
      {subjects.map((s, i) => {
        const [x, y] = at(i, R);
        return <line key={s.subject} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-line)" strokeWidth="1" />;
      })}
      <g className="radar-grow">
        <polygon points={shape.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} fill="var(--color-sky)" fillOpacity="0.2" stroke="var(--color-sky)" strokeWidth="2" strokeLinejoin="round" />
        {shape.map(([x, y], i) => (
          <circle key={subjects[i].subject} cx={x} cy={y} r="3.5" fill="var(--color-ink)" stroke="var(--color-sky)" strokeWidth="2" />
        ))}
      </g>
      {subjects.map((s, i) => {
        const [x, y] = at(i, R + 14);
        const anchor = x > cx + 4 ? "start" : x < cx - 4 ? "end" : "middle";
        // Nom, puis la moyenne dessous ; au-dessus du graphique, le bloc remonte pour ne pas toucher la forme.
        const top = y < cy - R * 0.8 ? -16 : y > cy + R * 0.8 ? 10 : -4;
        return (
          <text key={s.subject} x={x} y={y + top} textAnchor={anchor} fontSize="12" fill="var(--color-mute)">
            {short(s.subject)}
            <tspan x={x} dy="15" fill="var(--color-paper)">
              {n(s.average)}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

export default async function GradesPage() {
  const [{ supabase }, { m, locale }] = await Promise.all([requireUser("/app/notes"), getI18n()]);
  const t = m.app.grades;
  const [{ data, error }, { data: mathData }] = await Promise.all([supabase.rpc("my_grades"), supabase.rpc("my_mental_math")]);
  if (error) throw new Error(`Carnet indisponible (${error.code})`);
  const g = data as Grades;
  const math = mathData as MentalMath | null;
  const today = todayParis();
  const n = (v: number) => formatNumber(Math.round(Number(v) * 100) / 100, locale);

  return (
    <>
      <Aura tone="sky" />
      <header className="relative z-10 animate-in pt-2">
        <p className={label}>{t.title}</p>
        <p className={`mt-1 ${largeTitle} text-[44px] tabular-nums`}>{g.average !== null ? n(g.average) : "—"}</p>
        <p className="mt-1 text-sm text-mute">{g.average !== null ? `${t.average} · ${fmt(t.count, { n: g.count }, locale)}` : t.noAverage}</p>
      </header>

      <div className="relative z-10">
        {math ? <MentalMathPanel data={math} today={today} m={m} locale={locale} /> : null}

        {!g.enabled ? (
          <section className="glow-sky mt-6 animate-in rounded-[1.75rem] p-5">
            <p className="font-display text-[22px] leading-tight">{t.lockedTitle}</p>
            <p className="mt-2 text-sm text-paper/85">{t.lockedText}</p>
            <Link href="/abonnement" className={`${btnPrimary} mt-5`}>
              {t.lockedCta}
            </Link>
          </section>
        ) : (
          <div className="lg:grid lg:grid-cols-2 lg:gap-12">
            <div>
              {g.subjects.length ? (
                <section className="card mt-6 p-4">
                  <p className="text-[13px] text-mute">{t.progress}</p>
                  {g.subjects.length >= 3 ? (
                    <div className="mt-2">
                      <SubjectRadar subjects={[...g.subjects].sort((a, b) => b.count - a.count).slice(0, 8).sort((a, b) => a.subject.localeCompare(b.subject))} aria={t.radarAria} n={n} />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-mute">{t.radarMin}</p>
                  )}
                </section>
              ) : null}

              {g.subjects.length ? (
                <section className="mt-6">
                  <h2 className={sectionTitle}>{t.subjects}</h2>
                  <ul className="grouped mt-3">
                    {g.subjects.map((x) => (
                      <li key={x.subject} className="px-4 py-3">
                        <p className="flex items-baseline justify-between gap-4 text-[15px]">
                          <span className="truncate">{x.subject}</span>
                          <span className="font-display text-[17px] tabular-nums">{n(x.average)}</span>
                        </p>
                        <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                          <span className={`block h-1.5 rounded-full bg-linear-to-r from-[#1f8bff] to-[#6fe3ff] ${WIDTHS[Math.min(10, Math.round((Number(x.average) / 20) * 10))]}`} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="mt-6">
                <AddGrade
                  today={today}
                  minDay={addDays(today, -60)}
                  subjects={g.subjects.map((x) => x.subject)}
                  rule={t.pointsRule}
                  todayLine={g.points_today ? fmt(t.pointsToday, { n: g.points_today, max: g.points_cap }) : null}
                />
              </div>
            </div>

            <section className="mt-10 lg:mt-6">
              <h2 className={sectionTitle}>{t.history}</h2>
              {g.entries.length ? (
                <ul className="grouped mt-3">
                  {g.entries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-[15px]">{e.subject}</p>
                        <p className="mt-0.5 text-[12px] text-mute">
                          {formatDay(e.day, locale, { year: false })}
                          {Number(e.coefficient) !== 1 ? ` · ${fmt(t.coef, { n: n(e.coefficient) })}` : ""} ·{" "}
                          <span className={e.status === "proven" ? "text-ok" : ""}>{e.status === "proven" ? t.proven : t.declared}</span>
                          {e.status === "declared" ? (
                            <>
                              {" · "}
                              <DeleteGradeButton id={e.id} />
                            </>
                          ) : null}
                        </p>
                      </div>
                      <span className="shrink-0 font-display text-[19px] tabular-nums">
                        {n(e.score)}
                        <span className="text-sm text-mute">/{n(e.out_of)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="card mt-3 p-4 text-sm text-mute">{t.empty}</p>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}
