import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PhotoCapture } from "@/components/PhotoCapture";
import { requireUser } from "@/lib/auth";
import { btnPrimary } from "@/lib/ui";

export const metadata: Metadata = { title: "Contrôle" };

export default async function AuditPage({ params }: PageProps<"/app/controle/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser(`/app/controle/${id}`);

  const { data: audit } = await supabase.from("audits").select("id, status, due_at, penalty").eq("id", id).maybeSingle();
  if (!audit) notFound();

  const due = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", hour: "2-digit", minute: "2-digit" }).format(
    new Date(audit.due_at),
  );

  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-5 pt-10 pb-12">
      {audit.status === "open" ? (
        <PhotoCapture
          kind="audit"
          targetId={id}
          title="Contrôle."
          detail={`Envoie une photo ou une capture qui prouve ce que tu as validé, avant ${due}. Sans preuve acceptée : −${audit.penalty} points et une preuve refusée sur ton profil.`}
        />
      ) : (
        <div className="space-y-5">
          <h1 className="font-serif text-4xl">Contrôle.</h1>
          <p className="text-mute">
            {audit.status === "submitted"
              ? "Preuve envoyée. Elle sera examinée."
              : audit.status === "passed"
                ? "Contrôle réussi."
                : "Contrôle échoué."}
          </p>
          <Link href="/app" className={btnPrimary}>
            Retour
          </Link>
        </div>
      )}
    </main>
  );
}
