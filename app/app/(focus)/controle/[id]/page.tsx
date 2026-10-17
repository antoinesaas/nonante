import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Aura } from "@/components/Aura";
import { BackLink } from "@/components/BackLink";
import { PhotoCapture } from "@/components/PhotoCapture";
import { requireUser } from "@/lib/auth";
import { INTL } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { btnPrimary } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.proofs.auditTitle };
}

export default async function AuditPage({ params }: PageProps<"/app/controle/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [{ supabase }, { m, locale }] = await Promise.all([requireUser(`/app/controle/${id}`), getI18n()]);
  const t = m.app.proofs;

  const { data: audit } = await supabase.from("audits").select("id, status, due_at, penalty").eq("id", id).maybeSingle();
  if (!audit) notFound();

  const due = new Intl.DateTimeFormat(INTL[locale], { timeZone: "Europe/Paris", weekday: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(audit.due_at));

  return (
    <main className="relative isolate mx-auto min-h-dvh w-full max-w-xl overflow-x-clip px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <Aura tone="amber" />
      <BackLink />
      <div className="mt-4">
        {audit.status === "open" ? (
          <PhotoCapture kind="audit" targetId={id} title={t.auditHeading} detail={fmt(t.auditDetail, { due, n: audit.penalty })} />
        ) : (
          <div className="space-y-5">
            <h1 className="font-display text-[30px]">{t.auditHeading}</h1>
            <p className="text-mute">{audit.status === "submitted" ? t.auditSubmitted : audit.status === "passed" ? t.auditPassed : t.auditFailed}</p>
            <Link href="/app" className={btnPrimary}>
              {m.app.timer.finish}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
