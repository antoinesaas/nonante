import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { LinkForm } from "@/components/LinkForm";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Lien" };

export default async function LinkPage({ params }: PageProps<"/app/lien/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireUser(`/app/lien/${id}`);
  const { data: principle } = await supabase.from("principles").select("id, then_text, proof_type, target").eq("id", id).maybeSingle();
  if (!principle) notFound();
  if (principle.proof_type !== "lien") redirect("/app");
  const domains = (principle.target as { domains?: string[] }).domains ?? [];
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-5 pt-10 pb-12">
      <h1 className="font-serif text-4xl leading-tight">{principle.then_text}</h1>
      <p className="mt-3 text-sm text-mute">Preuve faible : 50 % des points, et un contrôle peut tomber.</p>
      <div className="mt-8">
        <LinkForm mode="principle" targetId={id} domains={domains} />
      </div>
    </main>
  );
}
