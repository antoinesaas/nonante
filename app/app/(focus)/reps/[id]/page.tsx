import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { RepCounter } from "@/components/RepCounter";
import { requireUser } from "@/lib/auth";
import type { Exercise } from "@/lib/reps";

export const metadata: Metadata = { title: "Répétitions" };

export default async function RepsPage({ params, searchParams }: PageProps<"/app/reps/[id]">) {
  const { id } = await params;
  const { epreuve } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser(`/app/reps/${id}`);

  if (epreuve === "1") {
    const { data: assignment } = await supabase.from("challenge_assignments").select("id, challenge_id").eq("id", id).maybeSingle();
    if (!assignment) notFound();
    const { data: challenge } = await supabase.from("challenges").select("title, proof_type, rule").eq("id", assignment.challenge_id).single();
    if (challenge?.proof_type !== "reps") redirect("/app/quete");
    const exercise = ((challenge.rule as { exercise?: Exercise }).exercise ?? "pushup") as Exercise;
    return <RepCounter mode="challenge" assignmentId={id} label={challenge.title} exercise={exercise} target={null} weakPoints={null} />;
  }

  const { data: principle } = await supabase
    .from("principles")
    .select("id, then_text, proof_type, target, difficulty")
    .eq("id", id)
    .maybeSingle();
  if (!principle) notFound();
  if (principle.proof_type !== "reps") redirect("/app");
  const target = principle.target as { exercise?: Exercise; reps?: number };
  return (
    <RepCounter
      mode="principle"
      principleId={id}
      label={principle.then_text}
      exercise={target.exercise ?? "pushup"}
      target={target.reps ?? 20}
      weakPoints={Math.round(principle.difficulty * 10 * 0.5)}
    />
  );
}
