import type { Metadata } from "next";
import Link from "next/link";
import { ArtBand } from "@/components/Art";
import { IMAGES } from "@/lib/art";
import { addDays } from "@/lib/answers";
import { requireUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";
import { fmt, formatDay, formatMoney } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { INTL } from "@/lib/i18n/config";
import type { Wallet } from "@/lib/types";
import { btnPrimary, label } from "@/lib/ui";
import { DeleteEntryButton, WalletEntryForm } from "./WalletForms";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.wallet.title };
}

const HEIGHTS = ["h-0", "h-[10%]", "h-[20%]", "h-[30%]", "h-[40%]", "h-[50%]", "h-[60%]", "h-[70%]", "h-[80%]", "h-[90%]", "h-full"];
const WIDTHS = ["w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]", "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full"];

export default async function WalletPage() {
  const [{ supabase }, { m, locale }] = await Promise.all([requireUser("/app/portefeuille"), getI18n()]);
  const t = m.app.wallet;
  const { data, error } = await supabase.rpc("my_wallet");
  if (error) throw new Error(`Portefeuille indisponible (${error.code})`);
  const w = data as Wallet;
  const today = todayParis();
  const money = (c: number) => formatMoney(c, locale);
  const maxMonth = Math.max(1, ...w.months.map((x) => x.proven_cents + x.declared_cents));
  const goalCents = w.goal?.target ? w.goal.target * 100 : null;
  const monthName = (iso: string) => new Intl.DateTimeFormat(INTL[locale], { month: "short", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 7)}-15T12:00:00Z`));

  return (
    <>
      <ArtBand slug={IMAGES.wallet} className="-mx-5 -mt-6 h-60 lg:mx-0 lg:mt-0">
        <p className={label}>{t.title}</p>
        <p className="mt-2 font-serif text-6xl leading-none tabular-nums">{money(w.proven_cents)}</p>
        <p className="mt-2 text-sm text-mute">{t.subtitle}</p>
      </ArtBand>

      {!w.enabled ? (
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
            <dl className="mt-8 grid grid-cols-3 gap-4 border-b border-line pb-6">
              <div>
                <dt className="text-xs text-mute">{t.month}</dt>
                <dd className="mt-1 font-serif text-2xl tabular-nums">{money(w.month_cents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-mute">{t.arc}</dt>
                <dd className="mt-1 font-serif text-2xl tabular-nums">{money(w.arc_cents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-mute">{t.declared}</dt>
                <dd className="mt-1 font-serif text-2xl text-mute tabular-nums">{money(w.declared_cents)}</dd>
              </div>
            </dl>

            {w.goal ? (
              <section className="mt-6">
                <p className={label}>{t.goal}</p>
                <p className="mt-2">{w.goal.title}</p>
                {goalCents ? (
                  <>
                    <span className="mt-3 block h-1 w-full bg-line">
                      <span className={`block h-1 bg-paper ${WIDTHS[Math.min(10, Math.floor((w.month_cents / goalCents) * 10))]}`} />
                    </span>
                    <p className="mt-1.5 text-xs text-mute">{fmt(t.goalProgress, { done: money(w.month_cents), target: money(goalCents) })}</p>
                  </>
                ) : null}
              </section>
            ) : null}

            {/* Graphique seulement quand il y a quelque chose à montrer. */}
            {w.months.some((x) => x.proven_cents + x.declared_cents > 0) ? (
              <section className="mt-10">
                <p className={label}>{t.months}</p>
                <div className="mt-4 flex h-40 items-end gap-3" role="img" aria-label={t.monthsAria}>
                  {w.months.map((x) => {
                    const total = x.proven_cents + x.declared_cents;
                    return (
                      <div key={x.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                        <span className="text-[10px] text-mute tabular-nums">{total ? money(total) : ""}</span>
                        <span className={`flex w-full flex-col justify-end ${HEIGHTS[Math.round((total / maxMonth) * 10)]}`}>
                          <span className="block w-full flex-1 origin-bottom animate-rise bg-paper" />
                        </span>
                        <span className="text-[11px] text-mute">{monthName(x.month)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="mt-12">
              <h2 className="font-serif text-3xl">{t.add}</h2>
              <p className="mt-2 text-sm text-mute">{t.pointsRule}</p>
              {w.points_today ? <p className="mt-1 text-sm">{fmt(t.pointsToday, { n: w.points_today, max: w.points_cap })}</p> : null}
              <div className="mt-6 border border-line bg-surface p-4">
                <WalletEntryForm today={today} minDay={addDays(today, -30)} />
              </div>
            </section>
          </div>

          <section className="mt-12 lg:mt-8">
            <h2 className="font-serif text-3xl">{t.history}</h2>
            {w.entries.length ? (
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {w.entries.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate">{entry.label}</p>
                      <p className="mt-1 text-xs text-mute">
                        {formatDay(entry.day, locale, { year: false })} · {t.sources[entry.source]} ·{" "}
                        <span className={entry.status === "rejected" ? "text-ko" : entry.status === "proven" ? "text-ok" : ""}>{t.status[entry.status]}</span>
                        {entry.status === "declared" ? (
                          <>
                            {" · "}
                            <DeleteEntryButton id={entry.id} />
                          </>
                        ) : null}
                      </p>
                    </div>
                    <span className={`shrink-0 font-serif text-xl tabular-nums ${entry.status === "rejected" ? "text-mute line-through" : ""}`}>{money(entry.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-mute">{t.empty}</p>
            )}
            <p className="mt-8 text-xs text-mute">{t.disclaimer}</p>
          </section>
        </div>
      )}
    </>
  );
}
