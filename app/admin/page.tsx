import Link from "next/link";
import { CohortForm } from "@/app/admin/CohortForm";
import { requireAdmin } from "@/lib/auth";
import { formatDayFr } from "@/lib/dates";
import { formatEuros } from "@/lib/money";

type Overview = {
  cohorts: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    enroll_open: boolean;
    is_test: boolean;
    price_cents: number;
    early_price_cents: number;
    closed_at: string | null;
    stats: { inscrits: number; actifs: number; ont_lache: number; ont_termine: number; verts_aujourdhui: number };
    pending: number;
    failed: number;
    revenue_cents: number;
    waitlist: number;
  }[];
  sales_by_source: { source: string; campaign: string; sales: number; revenue_cents: number }[];
  waitlist_by_source: { source: string; count: number }[];
  audits_pending: number;
  reports_open: number;
  stakes_to_settle: number;
};

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) return <p role="alert">{error.message}</p>;
  const o = data as Overview;

  return (
    <div className="space-y-14">
      <section className="grid grid-cols-3 gap-4">
        <Link href="/admin/controles" className="border border-line p-4">
          <p className="font-serif text-4xl tabular-nums">{o.audits_pending}</p>
          <p className="mt-1 text-xs text-mute">contrôles à traiter</p>
        </Link>
        <Link href="/admin/signalements" className="border border-line p-4">
          <p className="font-serif text-4xl tabular-nums">{o.reports_open}</p>
          <p className="mt-1 text-xs text-mute">signalements ouverts</p>
        </Link>
        <Link href="/admin/mises" className="border border-line p-4">
          <p className="font-serif text-4xl tabular-nums">{o.stakes_to_settle}</p>
          <p className="mt-1 text-xs text-mute">mises à régler</p>
        </Link>
      </section>

      <section>
        <h2 className="font-serif text-3xl">Cohortes</h2>
        <div className="mt-6 space-y-8">
          {o.cohorts.map((c) => (
            <article key={c.id} className="border-t border-line pt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg">
                  {c.name} {c.is_test ? <span className="text-xs text-mute">(test)</span> : null}
                </h3>
                <p className="text-sm text-mute">
                  {formatDayFr(c.start_date, { year: false })} → {formatDayFr(c.end_date)}
                  {c.closed_at ? " · clôturée" : c.enroll_open ? " · inscriptions ouvertes" : " · inscriptions fermées"}
                </p>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm sm:grid-cols-6">
                {[
                  ["Inscrits", c.stats.inscrits],
                  ["Actifs", c.stats.actifs],
                  ["Lâché", c.stats.ont_lache],
                  ["Tenu", c.stats.ont_termine],
                  ["Raté", c.failed],
                  ["Paiement en attente", c.pending],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <dt className="text-xs text-mute">{k}</dt>
                    <dd className="font-serif text-2xl tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-sm">
                Ventes : <span className="tabular-nums">{formatEuros(c.revenue_cents)}</span> · Liste d&apos;attente : {c.waitlist}
              </p>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-mute">Modifier la cohorte et ses prix</summary>
                <CohortForm cohort={c} />
              </details>
            </article>
          ))}
        </div>
        <details className="mt-8 border-t border-line pt-6">
          <summary className="cursor-pointer">Nouvelle cohorte</summary>
          <CohortForm cohort={null} />
        </details>
      </section>

      <section>
        <h2 className="font-serif text-3xl">Ventes par source</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs text-mute">
            <tr>
              <th className="py-2 font-normal">Source</th>
              <th className="py-2 font-normal">Campagne</th>
              <th className="py-2 text-right font-normal">Ventes</th>
              <th className="py-2 text-right font-normal">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-y border-line">
            {o.sales_by_source.map((s) => (
              <tr key={`${s.source}-${s.campaign}`}>
                <td className="py-2">{s.source}</td>
                <td className="py-2 text-mute">{s.campaign || "—"}</td>
                <td className="py-2 text-right tabular-nums">{s.sales}</td>
                <td className="py-2 text-right tabular-nums">{formatEuros(s.revenue_cents ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-serif text-3xl">Liste d&apos;attente par source</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
          {o.waitlist_by_source.map((w) => (
            <li key={w.source} className="flex justify-between py-2">
              <span>{w.source}</span>
              <span className="tabular-nums">{w.count}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
