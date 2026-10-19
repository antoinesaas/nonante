import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { FocusTimer } from "@/components/FocusTimer";
import { requireUser } from "@/lib/auth";
import { bareThen } from "@/lib/i18n/labels";
import { getI18n } from "@/lib/i18n/server";
import { todayParis } from "@/lib/dates";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.timer.title };
}

export default async function SessionPage({ params, searchParams }: PageProps<"/app/session/[id]">) {
  const { id } = await params;
  const { epreuve } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const [{ supabase, user }, { m }] = await Promise.all([requireUser(`/app/session/${id}`), getI18n()]);

  // Une session de cette page tourne encore (page rechargée, appli rouverte) : elle cassera à l'ouverture.
  const { data: running } = await supabase
    .from("proof_sessions")
    .select("principle_id, challenge_assignment_id")
    .eq("user_id", user.id)
    .eq("status", "running")
    .eq("kind", "session")
    .maybeSingle();
  const orphan = Boolean(running && (running.principle_id === id || running.challenge_assignment_id === id));

  if (epreuve === "1") {
    const { data: assignment } = await supabase.from("challenge_assignments").select("id, challenge_id").eq("id", id).maybeSingle();
    if (!assignment) notFound();
    const { data: challenge } = await supabase.from("challenges").select("code, title, proof_type").eq("id", assignment.challenge_id).single();
    if (challenge?.proof_type !== "session") redirect("/app/quete");
    const title = m.content.challenges[challenge.code]?.title ?? challenge.title;
    return <FocusTimer mode="challenge" assignmentId={id} label={title} minutes={null} orphan={orphan} />;
  }

  // RLS : seuls les principes de l'utilisateur sont lisibles.
  const { data: principle } = await supabase.from("principles").select("id, then_text, proof_type, target").eq("id", id).maybeSingle();
  if (!principle) notFound();
  if (principle.proof_type !== "session") redirect("/app");
  const minutes = Number((principle.target as { minutes?: number }).minutes ?? 50);
  // Déjà validé aujourd'hui : la session est une session bonus (v14), on dit combien il en reste.
  const today = todayParis();
  const [{ data: validated }, { count: bonusUsed }] = await Promise.all([
    supabase.from("validations").select("id").eq("principle_id", id).eq("day", today).neq("status", "rejected").maybeSingle(),
    supabase.from("points_ledger").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("day", today).eq("reason", "session_bonus"),
  ]);
  return <FocusTimer mode="principle" principleId={id} label={(() => { const x = bareThen(principle.then_text); return x.charAt(0).toUpperCase() + x.slice(1); })()} minutes={minutes} orphan={orphan} bonusUsed={validated ? (bonusUsed ?? 0) : null} />;
}
