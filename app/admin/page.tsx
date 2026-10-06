import Link from "next/link";
import { CompForm } from "@/app/admin/AdminForms";
import { requireAdmin } from "@/lib/auth";
import { formatDayFr } from "@/lib/dates";
import { formatEuros } from "@/lib/money";
import { PLAN_NAME } from "@/lib/plans";
import type { PlanId } from "@/lib/types";

type Overview = {
  subscribers: { plan: PlanId; interval: string; count: number }[];
  mrr_cents: number;
  revenue_30d_cents: number;
  revenue_total_cents: number;
  founders: number;
  cancelling: number;
  funnel: { profiles: number; arcs_built: number; paying: number };
  arcs: Record<string, number>;
  stats: { joueurs: number; arcs_en_cours: number; verts_aujourdhui: number; ont_lache: number; arcs_tenus: number };
  sales_by_source: { source: string; campaign: string; sales: number; revenue_cents: number }[];
  waitlist_by_source: { source: string; count: number }[];
  audits_pending: number;
  reports_open: number;
  comps: { pseudo: string; plan: string; until: string }[];
};

const INTERVAL: Record<string, string> = { month: "mensuel", year: "annuel", lifetime: "à vie" };

function pct(a: number, b: number): string {
  return b ? `${Math.round((100 * a) / b)} %` : "—";
}

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) return <p role="alert">{error.message}</p>;
  const o = data as Overview;

  return (
    <div className="space-y-14">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Revenu mensuel récurrent", formatEuros(o.mrr_cents)],
          ["Encaissé sur 30 jours", formatEuros(o.revenue_30d_cents)],
          ["Encaissé au total", formatEuros(o.revenue_total_cents)],
          ["Fondateurs", `${o.founders} / 100`],
        ].map(([k, v]) => (
          <div key={k} className="border border-line p-4">
            <p className="font-serif text-3xl tabular-nums">{v}</p>
            <p className="mt-1 text-xs text-mute">{k}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-4">
        <Link href="/admin/controles" className="border border-line p-4">
          <p className="font-serif text-4xl tabular-nums">{o.audits_pending}</p>
          <p className="mt-1 text-xs text-mute">contrôles à traiter</p>
        </Link>
        <Link href="/admin/signalements" className="border border-line p-4">
          <p className="font-serif text-4xl tabular-nums">{o.reports_open}</p>
          <p className="mt-1 text-xs text-mute">signalements ouverts</p>
        </Link>
      </section>

      <section>
        <h2 className="font-serif text-3xl">Abonnés</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
          {o.subscribers.map((s) => (
            <li key={`${s.plan}-${s.interval}`} className="flex justify-between py-2">
              <span>
                {PLAN_NAME[s.plan] ?? s.plan} · {INTERVAL[s.interval] ?? s.interval}
              </span>
              <span className="tabular-nums">{s.count}</span>
            </li>
          ))}
          {!o.subscribers.length ? <li className="py-2 text-mute">Aucun abonné pour l&apos;instant.</li> : null}
        </ul>
        <p className="mt-3 text-sm text-mute">{o.cancelling} résiliation(s) en fin de période.</p>
      </section>

      <section>
        <h2 className="font-serif text-3xl">Entonnoir</h2>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-mute">Profils créés</dt>
            <dd className="font-serif text-3xl tabular-nums">{o.funnel.profiles}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Arcs construits</dt>
            <dd className="font-serif text-3xl tabular-nums">{o.funnel.arcs_built}</dd>
            <dd className="text-xs text-mute">{pct(o.funnel.arcs_built, o.funnel.profiles)}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Payants</dt>
            <dd className="font-serif text-3xl tabular-nums">{o.funnel.paying}</dd>
            <dd className="text-xs text-mute">{pct(o.funnel.paying, o.funnel.arcs_built)} des arcs construits</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="font-serif text-3xl">Arcs</h2>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-sm sm:grid-cols-5">
          {[
            ["En construction", o.arcs.draft ?? 0],
            ["Actifs", o.arcs.active ?? 0],
            ["Tenus", o.arcs.completed ?? 0],
            ["Ratés", o.arcs.failed ?? 0],
            ["Lâchés", o.arcs.abandoned ?? 0],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-xs text-mute">{k}</dt>
              <dd className="font-serif text-3xl tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-mute">{o.stats.verts_aujourdhui} joueurs déjà au vert aujourd&apos;hui.</p>
      </section>

      <section>
        <h2 className="font-serif text-3xl">Ventes par source</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs text-mute">
            <tr>
              <th className="py-2 font-normal">Source</th>
              <th className="py-2 font-normal">Campagne</th>
              <th className="py-2 text-right font-normal">Paiements</th>
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
        <h2 className="font-serif text-3xl">Accès offerts</h2>
        <p className="mt-2 text-sm text-mute">Pour tester, ou pour un partenaire. Chaque accès est journalisé.</p>
        <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
          {o.comps.map((c) => (
            <li key={c.pseudo} className="flex justify-between py-2">
              <span>{c.pseudo}</span>
              <span className="text-mute">
                {PLAN_NAME[c.plan as PlanId] ?? c.plan} jusqu&apos;au {formatDayFr(c.until)}
              </span>
            </li>
          ))}
          {!o.comps.length ? <li className="py-2 text-mute">Aucun.</li> : null}
        </ul>
        <CompForm />
      </section>
    </div>
  );
}
