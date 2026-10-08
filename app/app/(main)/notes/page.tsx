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

/** Courbe de la moyenne par semaine, sur 20 (SVG, dessinée à l'apparition). */
function Progress({ weeks, aria, weekLabel }: { weeks: Grades["weeks"]; aria: string; weekLabel: (w: string) => string }) {
  const W = 320;
  const H = 120;
  const pad = 8;
  const xs = (i: number) => (weeks.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (weeks.length - 1));
  const ys = (v: number) => H - pad - (Math.max(0, Math.min(20, v)) / 20) * (H - 2 * pad);
  const d = weeks.map((w, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)} ${ys(Number(w.average)).toFixed(1)}`).join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" role="img" aria-label={aria}>
        {[5, 10, 15].map((g) => (
          <line key={g} x1="0" x2={W} y1={ys(g)} y2={ys(g)} stroke="var(--color-line)" strokeWidth="1" strokeDasharray="2 4" />
        ))}
        {weeks.length > 1 ? <path d={d} pathLength="1" fill="none" stroke="var(--color-paper)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="stroke-draw" /> : null}
        {weeks.map((w, i) => (
          <circle key={w.week} cx={xs(i)} cy={ys(Number(w.average))} r="3.5" fill="var(--color-ink)" stroke="var(--color-paper)" strokeWidth="2" />
        ))}
      </svg>
      {weeks.length ? (
        <figcaption className="mt-1 flex justify-between text-[11px] text-mute">
          <span>{weekLabel(weeks[0].week)}</span>
          {weeks.length > 1 ? <span>{weekLabel(weeks[weeks.length - 1].week)}</span> : null}
        </figcaption>
      ) : null}
    </figure>
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
            {g.weeks.length ? (
              <section className="mt-8">
                <p className={label}>{t.progress}</p>
                <div className="mt-4">
                  <Progress weeks={g.weeks} aria={t.progressAria} weekLabel={(w) => fmt(t.weekOf, { date: formatDay(w, locale, { year: false }) })} />
                </div>
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
              <p className="mt-2 text-sm text-mute">{g.xp_today ? t.xpDone : t.xpNext}</p>
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
