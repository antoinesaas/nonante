import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { FocusTimer } from "@/components/FocusTimer";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Session" };

export default async function SessionPage({ params, searchParams }: PageProps<"/app/session/[id]">) {
  const { id } = await params;
  const { epreuve } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser(`/app/session/${id}`);

  if (epreuve === "1") {
    const { data: assignment } = await supabase.from("challenge_assignments").select("id, challenge_id").eq("id", id).maybeSingle();
    if (!assignment) notFound();
    const { data: challenge } = await supabase.from("challenges").select("title, proof_type").eq("id", assignment.challenge_id).single();
    if (challenge?.proof_type !== "session") redirect("/app/quete");
    return <FocusTimer mode="challenge" assignmentId={id} label={challenge.title} minutes={null} />;
  }

  // RLS : seuls les principes de l'utilisateur sont lisibles.
  const { data: principle } = await supabase.from("principles").select("id, then_text, proof_type, target").eq("id", id).maybeSingle();
  if (!principle) notFound();
  if (principle.proof_type !== "session") redirect("/app");
  const minutes = Number((principle.target as { minutes?: number }).minutes ?? 50);
  return <FocusTimer mode="principle" principleId={id} label={principle.then_text} minutes={minutes} />;
}
