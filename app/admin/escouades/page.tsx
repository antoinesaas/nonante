import { SquadForm } from "@/app/admin/AdminForms";
import { requireAdmin } from "@/lib/auth";
import { formatDayFr } from "@/lib/dates";

type AdminSquad = {
  id: string;
  name: string;
  description: string | null;
  code: string;
  is_public: boolean;
  is_official: boolean;
  start_date: string | null;
  members: number;
  owner: string | null;
};

export default async function AdminSquadsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_squads");
  if (error) return <p role="alert">{error.message}</p>;
  const squads = (data as AdminSquad[]) ?? [];
  const official = squads.filter((s) => s.is_official);
  const others = squads.filter((s) => !s.is_official);

  return (
    <div className="space-y-14">
      <section>
        <h1 className="font-serif text-4xl">Escouades officielles</h1>
        <p className="mt-2 text-sm text-mute">Avec une date de départ, elles sont proposées comme départ collectif à l&apos;onboarding.</p>
        <div className="mt-6 space-y-8">
          {official.map((s) => (
            <article key={s.id} className="border-t border-line pt-6">
              <p className="text-lg">
                {s.name} <span className="text-sm text-mute">· {s.members} membres · code {s.code}</span>
              </p>
              {s.start_date ? <p className="text-sm text-mute">Départ le {formatDayFr(s.start_date)}</p> : null}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-mute">Modifier</summary>
                <SquadForm squad={s} />
              </details>
            </article>
          ))}
        </div>
        <details className="mt-8 border-t border-line pt-6">
          <summary className="cursor-pointer">Nouvelle escouade officielle</summary>
          <SquadForm squad={null} />
        </details>
      </section>

      <section>
        <h2 className="font-serif text-3xl">Escouades des joueurs</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
          {others.map((s) => (
            <li key={s.id} className="flex justify-between gap-4 py-2">
              <span>
                {s.name} <span className="text-mute">· {s.is_public ? "publique" : "privée"} · par {s.owner ?? "—"}</span>
              </span>
              <span className="tabular-nums">{s.members}</span>
            </li>
          ))}
          {!others.length ? <li className="py-2 text-mute">Aucune.</li> : null}
        </ul>
      </section>
    </div>
  );
}
