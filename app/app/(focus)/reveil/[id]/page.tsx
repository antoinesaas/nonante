import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/BackLink";
import { WakeCheck } from "@/components/WakeCheck";
import { requireUser } from "@/lib/auth";
import type { Locale } from "@/lib/i18n/config";
import { formatTime } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.proofs.wakeTitle };
}

/** Fenêtre de 2 h 30 avant l'heure de lever (même règle que le serveur). */
function wakeWindow(before: string, locale: Locale): { from: string; to: string } {
  const [h, m] = before.split(":").map(Number);
  const start = h * 60 + m - 150;
  const from = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
  return { from: formatTime(from, locale), to: formatTime(before, locale) };
}

export default async function WakePage({ params, searchParams }: PageProps<"/app/reveil/[id]">) {
  const { id } = await params;
  const { epreuve } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const [{ supabase }, { m, locale }] = await Promise.all([requireUser(`/app/reveil/${id}`), getI18n()]);

  if (epreuve === "1") {
    const { data: assignment } = await supabase.from("challenge_assignments").select("id, challenge_id").eq("id", id).maybeSingle();
    if (!assignment) notFound();
    const { data: challenge } = await supabase.from("challenges").select("code, title, proof_type, rule").eq("id", assignment.challenge_id).single();
    if (challenge?.proof_type !== "reveil") redirect("/app/quete");
    const before = (challenge.rule as { before?: string }).before ?? "08:00";
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-4 pb-12">
        <BackLink href="/app/quete" />
        <div className="my-auto">
          <WakeCheck mode="challenge" assignmentId={id} label={m.content.challenges[challenge.code]?.title ?? challenge.title} window={wakeWindow(before, locale)} />
        </div>
      </main>
    );
  }

  const { data: principle } = await supabase.from("principles").select("id, if_text, then_text, proof_type, target").eq("id", id).maybeSingle();
  if (!principle) notFound();
  if (principle.proof_type !== "reveil") redirect("/app");
  const before = (principle.target as { before?: string }).before ?? "07:00";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-4 pb-12">
      <BackLink />
      <div className="my-auto">
        <WakeCheck mode="principle" principleId={id} label={`${principle.if_text}, ${principle.then_text}`} window={wakeWindow(before, locale)} />
      </div>
    </main>
  );
}
