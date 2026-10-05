import { StakeDonated } from "@/app/admin/mises/StakeDonated";
import { requireAdmin } from "@/lib/auth";
import { formatEuros } from "@/lib/money";

type Stake = {
  enrollment_id: string;
  pseudo: string;
  cohort: string;
  status: string;
  stake_status: "held" | "refunded" | "forfeited";
  stake_cents: number;
  donated_at: string | null;
};

const LABEL = { held: "en dépôt", refunded: "remboursée", forfeited: "à reverser à l'association" };

export default async function StakesPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_stakes");
  if (error) return <p role="alert">{error.message}</p>;
  const stakes = (data as Stake[]) ?? [];
  const toDonate = stakes.filter((s) => s.stake_status === "forfeited" && !s.donated_at);
  return (
    <section>
      <h1 className="font-serif text-4xl">Mises</h1>
      <p className="mt-2 text-sm text-mute">
        {process.env.FEATURE_STAKE === "true" ? "La mise sur soi est activée." : "La mise sur soi est désactivée (FEATURE_STAKE=false)."}{" "}
        Les mises perdues sont reversées à une association, jamais conservées ni redistribuées. Arcs tenus : remboursement
        automatique à la clôture.
      </p>
      <p className="mt-6">
        À reverser : <span className="font-serif text-3xl tabular-nums">{formatEuros(toDonate.reduce((s, x) => s + x.stake_cents, 0))}</span>
      </p>
      {stakes.length === 0 ? <p className="mt-8 text-mute">Aucune mise.</p> : null}
      <ul className="mt-8 divide-y divide-line border-y border-line text-sm">
        {stakes.map((s) => (
          <li key={s.enrollment_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span>
              {s.pseudo} <span className="text-mute">· {s.cohort} · {s.status}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="tabular-nums">{formatEuros(s.stake_cents)}</span>
              <span className="text-mute">{s.donated_at ? "reversée" : LABEL[s.stake_status]}</span>
              {s.stake_status === "forfeited" && !s.donated_at ? <StakeDonated enrollmentId={s.enrollment_id} /> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
