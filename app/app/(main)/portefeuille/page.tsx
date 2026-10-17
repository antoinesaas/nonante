import type { Metadata } from "next";
import Link from "next/link";
import { Aura } from "@/components/Aura";
import { addDays } from "@/lib/answers";
import { requireUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";
import { fmt, formatDay, formatMoney } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { INTL } from "@/lib/i18n/config";
import type { Wallet } from "@/lib/types";
import { btnPrimary, label, largeTitle, sectionTitle } from "@/lib/ui";
import { AddWalletEntry, DeleteEntryButton } from "./WalletForms";

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
      <Aura tone="mint" />
      <header className="relative z-10 animate-in pt-2">
        <p className={label}>{t.title}</p>
        <p className={`mt-1 ${largeTitle} text-[44px] tabular-nums`}>{money(w.proven_cents)}</p>
        <p className="mt-1 text-sm text-mute">{t.subtitle}</p>
      </header>

      {!w.enabled ? (
        <section className="glow-mint relative z-10 mt-8 animate-in rounded-[1.75rem] p-5">
          <p className="font-display text-[22px] leading-tight">{t.lockedTitle}</p>
          <p className="mt-2 text-sm text-paper/85">{t.lockedText}</p>
          <Link href="/abonnement" className={`${btnPrimary} mt-5`}>
            {t.lockedCta}
          </Link>
        </section>
      ) : (
        <div className="relative z-10 lg:grid lg:grid-cols-2 lg:gap-12">
          <div>
            <dl className="mt-6 grid grid-cols-3 gap-2">
              {[
                { k: t.month, v: money(w.month_cents), muted: false },
                { k: t.arc, v: money(w.arc_cents), muted: false },
                { k: t.declared, v: money(w.declared_cents), muted: true },
              ].map((x) => (
                <div key={x.k} className="card p-3.5">
                  <dt className="text-[12px] text-mute">{x.k}</dt>
                  <dd className={`mt-1 font-display text-[19px] leading-tight tabular-nums ${x.muted ? "text-mute" : ""}`}>{x.v}</dd>
                </div>
              ))}
            </dl>

            {w.goal ? (
              <section className="card mt-3 p-4">
                <p className="text-[13px] text-mute">{t.goal}</p>
                <p className="mt-0.5 text-[15px]">{w.goal.title}</p>
                {goalCents ? (
                  <>
                    <span className="mt-3 block h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
                      <span className={`block h-2 rounded-full bg-linear-to-r from-[#1fbf7a] to-[#9bf5c9] ${WIDTHS[Math.min(10, Math.floor((w.month_cents / goalCents) * 10))]}`} />
                    </span>
                    <p className="mt-1.5 text-xs text-mute">{fmt(t.goalProgress, { done: money(w.month_cents), target: money(goalCents) })}</p>
                  </>
                ) : null}
              </section>
            ) : null}

            {/* Graphique seulement quand il y a quelque chose à montrer. */}
            {w.months.some((x) => x.proven_cents + x.declared_cents > 0) ? (
              <section className="card mt-3 p-4">
                <p className="text-[13px] text-mute">{t.months}</p>
                <div className="mt-4 flex h-36 items-end gap-2.5" role="img" aria-label={t.monthsAria}>
                  {w.months.map((x) => {
                    const total = x.proven_cents + x.declared_cents;
                    return (
                      <div key={x.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                        <span className="text-[10px] text-mute tabular-nums">{total ? money(total) : ""}</span>
                        <span className={`flex w-full flex-col justify-end ${HEIGHTS[Math.max(total ? 1 : 0, Math.round((total / maxMonth) * 10))]}`}>
                          <span className="block w-full flex-1 origin-bottom animate-rise rounded-lg bg-linear-to-t from-[#1fbf7a] to-[#9bf5c9]" />
                        </span>
                        <span className="text-[11px] text-mute">{monthName(x.month)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <div className="mt-6">
              <AddWalletEntry
                today={today}
                minDay={addDays(today, -30)}
                rule={t.pointsRule}
                todayLine={w.points_today ? fmt(t.pointsToday, { n: w.points_today, max: w.points_cap }) : null}
              />
            </div>
          </div>

          <section className="mt-10 lg:mt-6">
            <h2 className={sectionTitle}>{t.history}</h2>
            {w.entries.length ? (
              <ul className="grouped mt-3">
                {w.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[15px]">{entry.label}</p>
                      <p className="mt-0.5 text-[12px] text-mute">
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
                    <span className={`shrink-0 font-display text-[17px] tabular-nums ${entry.status === "rejected" ? "text-mute line-through" : ""}`}>{money(entry.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card mt-3 p-4 text-sm text-mute">{t.empty}</p>
            )}
            <p className="mt-6 px-1 text-xs text-mute">{t.disclaimer}</p>
          </section>
        </div>
      )}
    </>
  );
}
