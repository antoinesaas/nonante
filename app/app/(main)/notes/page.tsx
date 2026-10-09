import type { Metadata } from "next";
import Link from "next/link";
import { ArtBand } from "@/components/Art";
import { IMAGES } from "@/lib/art";
import { addDays } from "@/lib/answers";
import { requireUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";
import { fmt, formatDay, formatNumber } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import type { Grades } from "@/lib/types";
import { btnPrimary, label } from "@/lib/ui";
import { DeleteGradeButton, GradeForm } from "./GradeForms";

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
        <polygon points={shape.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} fill="var(--color-paper)" fillOpacity="0.16" stroke="var(--color-paper)" strokeWidth="2" strokeLinejoin="round" />
        {shape.map(([x, y], i) => (
          <circle key={subjects[i].subject} cx={x} cy={y} r="3.5" fill="var(--color-ink)" stroke="var(--color-paper)" strokeWidth="2" />
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
  const { data, error } = await supabase.rpc("my_grades");
  if (error) throw new Error(`Carnet indisponible (${error.code})`);
  const g = data as Grades;
  const today = todayParis();
  const n = (v: number) => formatNumber(Math.round(Number(v) * 100) / 100, locale);

  return (
    <>
      <ArtBand slug={IMAGES.grades} className="-mx-5 -mt-6 h-60 lg:mx-0 lg:mt-0">
        <p className={label}>{t.title}</p>
        <p className="mt-2 font-serif text-6xl leading-none tabular-nums">{g.average !== null ? n(g.average) : "—"}</p>
        <p className="mt-2 text-sm text-mute">{g.average !== null ? `${t.average} · ${fmt(t.count, { n: g.count }, locale)}` : t.noAverage}</p>
      </ArtBand>

      {!g.enabled ? (
        <section className="mt-8 animate-rise border border-paper p-5">
          <p className="font-serif text-2xl leading-tight">{t.lockedTitle}</p>
          <p className="mt-3 text-sm text-mute">{t.lockedText}</p>
          <Link href="/abonnement" className={`${btnPrimary} mt-5`}>
            {t.lockedCta}
          </Link>
        </section>
      ) : (
        <div className="lg:grid lg:grid-cols-2 lg:gap-12">
          <div>
            {g.subjects.length ? (
              <section className="mt-8">
                <p className={label}>{t.progress}</p>
                {g.subjects.length >= 3 ? (
                  <div className="mt-4">
                    <SubjectRadar subjects={[...g.subjects].sort((a, b) => b.count - a.count).slice(0, 8).sort((a, b) => a.subject.localeCompare(b.subject))} aria={t.radarAria} n={n} />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-mute">{t.radarMin}</p>
                )}
              </section>
            ) : null}

            {g.subjects.length ? (
              <section className="mt-10">
                <p className={label}>{t.subjects}</p>
                <ul className="mt-4 space-y-4">
                  {g.subjects.map((s) => (
                    <li key={s.subject}>
                      <p className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="truncate">{s.subject}</span>
                        <span className="font-serif text-xl tabular-nums">{n(s.average)}</span>
                      </p>
                      <span className="mt-1.5 block h-1 w-full bg-line">
                        <span className={`block h-1 bg-paper ${WIDTHS[Math.min(10, Math.round((Number(s.average) / 20) * 10))]}`} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="mt-12">
              <h2 className="font-serif text-3xl">{t.add}</h2>
              <p className="mt-2 text-sm text-mute">{t.pointsRule}</p>
              {g.points_today ? <p className="mt-1 text-sm">{fmt(t.pointsToday, { n: g.points_today, max: g.points_cap })}</p> : null}
              <div className="mt-6 border border-line bg-surface p-4">
                <GradeForm today={today} minDay={addDays(today, -60)} subjects={g.subjects.map((s) => s.subject)} />
              </div>
            </section>
          </div>

          <section className="mt-12 lg:mt-8">
            <h2 className="font-serif text-3xl">{t.history}</h2>
            {g.entries.length ? (
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {g.entries.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate">{e.subject}</p>
                      <p className="mt-1 text-xs text-mute">
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
                    <span className="shrink-0 font-serif text-xl tabular-nums">
                      {n(e.score)}
                      <span className="text-sm text-mute">/{n(e.out_of)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-mute">{t.empty}</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
