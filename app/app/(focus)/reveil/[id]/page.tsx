import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { WakeCheck } from "@/components/WakeCheck";
import { requireUser } from "@/lib/auth";
import { timeFr } from "@/lib/proofs";

export const metadata: Metadata = { title: "Réveil" };

/** Fenêtre de 2 h 30 avant l'heure de lever (même règle que le serveur). */
function windowLabel(before: string): string {
  const [h, m] = before.split(":").map(Number);
  const start = h * 60 + m - 150;
  const from = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
  return `${timeFr(from)} et ${timeFr(before)}`;
}

export default async function WakePage({ params, searchParams }: PageProps<"/app/reveil/[id]">) {
  const { id } = await params;
  const { epreuve } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser(`/app/reveil/${id}`);

  if (epreuve === "1") {
    const { data: assignment } = await supabase.from("challenge_assignments").select("id, challenge_id").eq("id", id).maybeSingle();
    if (!assignment) notFound();
    const { data: challenge } = await supabase.from("challenges").select("title, proof_type, rule").eq("id", assignment.challenge_id).single();
    if (challenge?.proof_type !== "reveil") redirect("/app/epreuve");
    const before = (challenge.rule as { before?: string }).before ?? "08:00";
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12">
        <WakeCheck mode="challenge" assignmentId={id} label={challenge.title} window={windowLabel(before)} />
      </main>
    );
  }

  const { data: principle } = await supabase.from("principles").select("id, if_text, then_text, proof_type, target").eq("id", id).maybeSingle();
  if (!principle) notFound();
  if (principle.proof_type !== "reveil") redirect("/app");
  const before = (principle.target as { before?: string }).before ?? "07:00";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5 py-12">
      <WakeCheck mode="principle" principleId={id} label={`${principle.if_text}, ${principle.then_text}`} window={windowLabel(before)} />
    </main>
  );
}
