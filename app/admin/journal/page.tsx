import { requireAdmin } from "@/lib/auth";

type Entry = { action: string; target: string; created_at: string; admin: string | null };

export default async function AuditLogPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_recent_log");
  if (error) return <p role="alert">{error.message}</p>;
  const entries = (data as Entry[]) ?? [];
  return (
    <section>
      <h1 className="font-serif text-4xl">Journal</h1>
      <p className="mt-2 text-sm text-mute">Les 50 dernières actions admin.</p>
      <ul className="mt-8 divide-y divide-line border-y border-line text-sm">
        {entries.map((e, i) => (
          <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
            <span>
              {e.action} <span className="text-mute">{e.target}</span>
            </span>
            <span className="text-mute">
              {e.admin ?? "—"} · {new Date(e.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
