import Link from "next/link";
import { ReportActions } from "@/app/admin/signalements/ReportActions";
import { requireAdmin } from "@/lib/auth";

type Report = {
  id: string;
  reason: string;
  status: "open" | "dismissed" | "actioned";
  created_at: string;
  reporter: string | null;
  reported: string | null;
  reported_is_public: boolean | null;
};

export default async function ReportsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_reports");
  if (error) return <p role="alert">{error.message}</p>;
  const reports = (data as Report[]) ?? [];
  return (
    <section>
      <h1 className="font-serif text-4xl">Signalements</h1>
      {reports.length === 0 ? <p className="mt-8 text-mute">Aucun signalement.</p> : null}
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {reports.map((r) => (
          <li key={r.id} className="space-y-2 py-5">
            <p>
              {r.reported_is_public && r.reported ? (
                <Link href={`/u/${r.reported}`} className="font-medium underline underline-offset-4">
                  {r.reported}
                </Link>
              ) : (
                <span className="font-medium">{r.reported ?? "compte supprimé"}</span>
              )}{" "}
              <span className="text-sm text-mute">
                signalé par {r.reporter ?? "—"} · {new Date(r.created_at).toLocaleDateString("fr-FR")} · {r.status}
              </span>
            </p>
            <p className="text-sm">{r.reason}</p>
            {r.status === "open" ? <ReportActions reportId={r.id} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
