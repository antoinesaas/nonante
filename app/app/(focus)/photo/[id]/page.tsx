import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/BackLink";
import { PhotoCapture } from "@/components/PhotoCapture";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.proofs.photoTitle };
}

export default async function PhotoPage({ params, searchParams }: PageProps<"/app/photo/[id]">) {
  const { id } = await params;
  const { epreuve } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const [{ supabase }, { m }] = await Promise.all([requireUser(`/app/photo/${id}`), getI18n()]);
  const t = m.app.proofs;

  if (epreuve === "1") {
    const { data: assignment } = await supabase.from("challenge_assignments").select("id, challenge_id").eq("id", id).maybeSingle();
    if (!assignment) notFound();
    const { data: challenge } = await supabase.from("challenges").select("code, title, description, proof_type").eq("id", assignment.challenge_id).single();
    if (challenge?.proof_type !== "photo") redirect("/app/quete");
    const c = m.content.challenges[challenge.code] ?? { title: challenge.title, description: challenge.description };
    return (
      <main className="mx-auto min-h-dvh w-full max-w-xl px-5 pt-4 pb-12">
        <BackLink href="/app/quete" />
        <div className="mt-4">
          <PhotoCapture kind="challenge" targetId={id} title={c.title} detail={c.description} backHref="/app/quete" />
        </div>
      </main>
    );
  }

  const { data: principle } = await supabase.from("principles").select("id, if_text, then_text, proof_type").eq("id", id).maybeSingle();
  if (!principle) notFound();
  if (principle.proof_type !== "photo" && principle.proof_type !== "capture") redirect("/app");
  const capture = principle.proof_type === "capture";
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-5 pt-4 pb-12">
      <BackLink />
      <div className="mt-4">
        <PhotoCapture kind="principle" targetId={id} title={principle.then_text} mode={capture ? "file" : "camera"} detail={capture ? t.captureDetail : t.photoDetail} />
      </div>
    </main>
  );
}
