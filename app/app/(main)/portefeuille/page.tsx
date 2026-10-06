import type { Metadata } from "next";
import Link from "next/link";
import { ArtBand } from "@/components/Art";
import { IMAGES } from "@/lib/art";
import { requireUser } from "@/lib/auth";
import { formatDayFr, todayParis } from "@/lib/dates";
import { formatEuros } from "@/lib/money";
import type { Wallet, WalletEntry } from "@/lib/types";
import { btnPrimary, label } from "@/lib/ui";
import { DeleteEntryButton, WalletEntryForm } from "./WalletForms";

export const metadata: Metadata = { title: "Portefeuille" };

const SOURCE_LABEL: Record<WalletEntry["source"], string> = {
  vente: "Vente",
  client: "Client",
  freelance: "Freelance",
  contenu: "Contenu",
  autre: "Autre",
};

const STATUS_LABEL: Record<WalletEntry["status"], string> = {
  proven: "prouvé",
  audit_pending: "contrôle en cours",
  declared: "non prouvé",
  rejected: "refusé",
};

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const HEIGHTS = ["h-0", "h-[10%]", "h-[20%]", "h-[30%]", "h-[40%]", "h-[50%]", "h-[60%]", "h-[70%]", "h-[80%]", "h-[90%]", "h-full"];

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function WalletPage() {
  const { supabase } = await requireUser("/app/portefeuille");
  const { data, error } = await supabase.rpc("my_wallet");
  if (error) throw new Error(`Portefeuille indisponible (${error.code})`);
  const w = data as Wallet;
  const today = todayParis();
  const maxMonth = Math.max(1, ...w.months.map((m) => m.proven_cents + m.declared_cents));
  const goalCents = w.goal?.target ? w.goal.target * 100 : null;

  return (
    <>
      <ArtBand slug={IMAGES.wallet} className="-mx-5 -mt-6 h-60">
        <p className={label}>Portefeuille</p>
        <p className="mt-2 font-serif text-6xl leading-none tabular-nums">{formatEuros(w.proven_cents)}</p>
        <p className="mt-2 text-sm text-mute">gagnés et prouvés grâce à ton projet</p>
      </ArtBand>

      {!w.enabled ? (
        <section className="mt-8 border border-paper p-5">
          <p className="font-serif text-2xl leading-tight">Ton argent, prouvé, au même endroit que ta discipline.</p>
          <p className="mt-3 text-sm text-mute">
            Note chaque euro gagné avec ton projet, avec une capture en preuve. Il fait monter ta stat Business, débloque des
            succès (1 €, 100 €, 1 000 €, 10 000 €) et suit ton objectif de revenu. Réservé au plan Pro.
          </p>
          <Link href="/abonnement" className={`${btnPrimary} mt-5`}>
            Passer Pro
          </Link>
        </section>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-b border-line pb-6">
            <div>
              <dt className="text-xs text-mute">Ce mois</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums">{formatEuros(w.month_cents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-mute">Pendant l&apos;arc</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums">{formatEuros(w.arc_cents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-mute">Non prouvé</dt>
              <dd className="mt-1 font-serif text-2xl text-mute tabular-nums">{formatEuros(w.declared_cents)}</dd>
            </div>
          </dl>

          {w.goal ? (
            <section className="mt-6">
              <p className={label}>Objectif</p>
              <p className="mt-2">{w.goal.title}</p>
              {goalCents ? (
                <>
                  <span className="mt-3 block h-1 w-full bg-line">
                    <span className={`block h-1 bg-paper ${["w-0", "w-[10%]", "w-[20%]", "w-[30%]", "w-[40%]", "w-[50%]", "w-[60%]", "w-[70%]", "w-[80%]", "w-[90%]", "w-full"][Math.min(10, Math.floor((w.month_cents / goalCents) * 10))]}`} />
                  </span>
                  <p className="mt-1.5 text-xs text-mute">
                    {formatEuros(w.month_cents)} sur {formatEuros(goalCents)} ce mois-ci
                  </p>
                </>
              ) : null}
            </section>
          ) : null}

          <section className="mt-10">
            <p className={label}>6 derniers mois</p>
            <div className="mt-4 flex h-40 items-end gap-3" aria-label="Revenus par mois">
              {w.months.map((m) => {
                const total = m.proven_cents + m.declared_cents;
                const month = Number(m.month.slice(5, 7));
                return (
                  <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[10px] text-mute tabular-nums">{total ? formatEuros(total) : ""}</span>
                    <span className={`flex w-full flex-col justify-end ${HEIGHTS[Math.round((total / maxMonth) * 10)]}`}>
                      <span className="block w-full flex-1 bg-paper" />
                    </span>
                    <span className="text-[11px] text-mute">{MONTHS[month - 1]}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-serif text-3xl">Ajouter un revenu</h2>
            <p className="mt-2 text-sm text-mute">
              {w.xp_today ? "Tu as déjà gagné tes +15 points de revenu aujourd'hui." : "Premier revenu prouvé du jour : +15 points."}
            </p>
            <div className="mt-6 border border-line bg-surface p-4">
              <WalletEntryForm today={today} minDay={addDays(today, -30)} />
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-serif text-3xl">Historique</h2>
            {w.entries.length ? (
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {w.entries.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate">{entry.label}</p>
                      <p className="mt-1 text-xs text-mute">
                        {formatDayFr(entry.day, { year: false })} · {SOURCE_LABEL[entry.source]} ·{" "}
                        <span className={entry.status === "rejected" ? "text-ko" : entry.status === "proven" ? "text-ok" : ""}>
                          {STATUS_LABEL[entry.status]}
                        </span>
                        {entry.status === "declared" ? (
                          <>
                            {" · "}
                            <DeleteEntryButton id={entry.id} />
                          </>
                        ) : null}
                      </p>
                    </div>
                    <span className={`shrink-0 font-serif text-xl tabular-nums ${entry.status === "rejected" ? "text-mute line-through" : ""}`}>
                      {formatEuros(entry.amount_cents)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-mute">Rien encore. Le premier euro est le plus dur.</p>
            )}
          </section>

          <p className="mt-8 text-xs text-mute">
            Le portefeuille est un suivi personnel de ce que tu gagnes avec ton projet. Nonante ne verse ni ne garde
            d&apos;argent.
          </p>
        </>
      )}
    </>
  );
}
