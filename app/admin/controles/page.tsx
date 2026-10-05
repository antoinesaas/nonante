import { AuditActions } from "@/app/admin/controles/AuditActions";
import { requireAdmin } from "@/lib/auth";

type QueueItem = {
  id: string;
  status: "open" | "submitted";
  requested_at: string;
  due_at: string;
  submitted_at: string | null;
  penalty: number;
  pseudo: string;
  has_photo: boolean;
  principle: string | null;
  challenge: string | null;
  proof: { type: string; day: string; link: string | null; has_photo: boolean } | null;
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

export default async function AuditQueuePage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_audit_queue");
  if (error) return <p role="alert">{error.message}</p>;
  const queue = (data as QueueItem[]) ?? [];

  return (
    <section>
      <h1 className="font-serif text-4xl">Contrôles</h1>
      <p className="mt-2 text-sm text-mute">
        Les contrôles sans réponse sous 24 h échouent automatiquement. Les photos s&apos;ouvrent via une URL signée de 60 secondes.
      </p>
      {queue.length === 0 ? <p className="mt-8 text-mute">Rien à traiter.</p> : null}
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {queue.map((a) => (
          <li key={a.id} className="space-y-2 py-5">
            <p>
              <span className="font-medium">{a.pseudo}</span>{" "}
              <span className="text-sm text-mute">· {a.status === "submitted" ? `envoyé ${when(a.submitted_at!)}` : `attendu avant ${when(a.due_at)}`}</span>
            </p>
            <p className="text-sm">{a.principle ?? a.challenge}</p>
            {a.proof ? (
              <p className="text-xs text-mute">
                Preuve d&apos;origine : {a.proof.type}, le {a.proof.day}
                {a.proof.link ? (
                  <>
                    {" · "}
                    {/* Lien saisi par l'utilisateur : ouvert sans référent ni accès à la page. */}
                    <a href={a.proof.link} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4">
                      {a.proof.link}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
            <p className="text-xs text-mute">Refus : −{a.penalty} points et +1 preuve refusée.</p>
            <AuditActions auditId={a.id} hasAuditPhoto={a.has_photo} hasProofPhoto={Boolean(a.proof?.has_photo)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
