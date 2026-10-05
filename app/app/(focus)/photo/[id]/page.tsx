import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PhotoCapture } from "@/components/PhotoCapture";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Photo" };

export default async function PhotoPage({ params, searchParams }: PageProps<"/app/photo/[id]">) {
  const { id } = await params;
  const { epreuve } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser(`/app/photo/${id}`);

  if (epreuve === "1") {
    const { data: assignment } = await supabase.from("challenge_assignments").select("id, challenge_id").eq("id", id).maybeSingle();
    if (!assignment) notFound();
    const { data: challenge } = await supabase.from("challenges").select("title, description, proof_type").eq("id", assignment.challenge_id).single();
    if (challenge?.proof_type !== "photo") redirect("/app/epreuve");
    return (
      <main className="mx-auto min-h-dvh w-full max-w-xl px-5 pt-10 pb-12">
        <PhotoCapture kind="challenge" targetId={id} title={challenge.title} detail={challenge.description} />
      </main>
    );
  }

  const { data: principle } = await supabase.from("principles").select("id, if_text, then_text, proof_type").eq("id", id).maybeSingle();
  if (!principle) notFound();
  if (principle.proof_type !== "photo") redirect("/app");
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-5 pt-10 pb-12">
      <PhotoCapture
        kind="principle"
        targetId={id}
        title={principle.then_text}
        detail="Photo prise maintenant, dans l'app. Preuve faible : 50 % des points, et un contrôle peut tomber. Les photos restent privées et sont supprimées après 30 jours."
      />
    </main>
  );
}
