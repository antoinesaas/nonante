import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActivityRings } from "@/components/ActivityRings";
import { Aura } from "@/components/Aura";
import { BackLink } from "@/components/BackLink";
import { HistoryDay } from "@/app/app/(main)/historique/HistoryDay";
import { requireUser } from "@/lib/auth";
import { INTL } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { ARC_COMPLETION } from "@/lib/rules";
import type { WeekDay } from "@/lib/types";
import { label, largeTitle } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.history.title };
}

type History = { start: string | null; end: string | null; days: WeekDay[] };

/** Jour de la semaine ISO (1 = lundi) d'une date AAAA-MM-JJ. */
function isoDow(day: string): number {
  return ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

/**
 * Tout l'historique de l'arc, façon Apple Forme : un calendrier par mois, un mini-anneau par jour
 * (principes prouvés / prévus). Un toucher sur un jour ouvre son détail.
 */
export default async function HistoryPage() {
  const [{ supabase }, { m, locale }] = await Promise.all([requireUser("/app/historique"), getI18n()]);
  const t = m.app.history;
  const { data } = await supabase.rpc("my_history");
  const h = data as History | null;
  if (!h?.start) redirect("/app");

  const green = h.days.filter((d) => d.status === "green" || d.joker).length;
  const proven = h.days.reduce((s, d) => s + d.done, 0);
  const due = h.days.reduce((s, d) => s + d.due, 0);

  // Mois du plus récent au plus ancien.
  const months = new Map<string, WeekDay[]>();
  for (const d of h.days) {
    const key = d.day.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), d]);
  }
  const list = [...months.entries()].reverse();
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(INTL[locale], { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 5 + i, 12))),
  );

  return (
    <>
      <Aura tone="violet" />
      <BackLink />
      <header className="mt-5 animate-in">
        <p className={label}>{t.label}</p>
        <h1 className={`mt-1 ${largeTitle}`}>{t.title}</h1>
      </header>

      <section className="card mt-5 flex items-center gap-5 p-5">
        <ActivityRings
          rings={[
            { value: proven, max: Math.max(1, due), tone: "rose" },
            { value: green, max: Math.max(1, h.days.length), tone: "mint" },
            { value: green, max: ARC_COMPLETION.minGreenDays, tone: "sky" },
          ]}
          size={112}
          stroke={12}
          gap={3}
          label={fmt(t.ringsAria, { proven, due, green, days: h.days.length })}
        />
        <dl className="min-w-0 flex-1 space-y-2.5 text-sm">
          <div>
            <dt className="text-[12px] text-mute">{t.proven}</dt>
            <dd className="font-display text-[19px] tabular-nums text-[#ff4f86]">
              {proven}/{due}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-mute">{t.greenDays}</dt>
            <dd className="font-display text-[19px] tabular-nums text-[#5cf0a6]">
              {green}/{h.days.length}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-mute">{t.toHold}</dt>
            <dd className="font-display text-[19px] tabular-nums text-[#4fc3ff]">
              {green}/{ARC_COMPLETION.minGreenDays}
            </dd>
          </div>
        </dl>
      </section>

      {list.map(([month, days]) => {
        const lead = isoDow(days[0].day) - 1;
        const name = new Intl.DateTimeFormat(INTL[locale], { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
        return (
          <section key={month} className="mt-8">
            <h2 className="px-1 font-display text-[20px] first-letter:uppercase">{name}</h2>
            <div className="card mt-3 p-4">
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-mute">
                {weekdays.map((w, i) => (
                  <span key={i}>{w}</span>
                ))}
              </div>
              <ol className="mt-2 grid grid-cols-7 gap-x-1 gap-y-3">
                {Array.from({ length: lead }, (_, i) => (
                  <li key={`vide-${i}`} aria-hidden="true" />
                ))}
                {days.map((d) => (
                  <li key={d.day}>
                    <HistoryDay day={d} />
                  </li>
                ))}
              </ol>
            </div>
          </section>
        );
      })}
    </>
  );
}
