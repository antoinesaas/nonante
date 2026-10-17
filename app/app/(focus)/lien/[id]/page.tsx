import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Aura } from "@/components/Aura";
import { BackLink } from "@/components/BackLink";
import { LinkForm } from "@/components/LinkForm";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.app.proofs.linkTitle };
}

export default async function LinkPage({ params }: PageProps<"/app/lien/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [{ supabase }, { m }] = await Promise.all([requireUser(`/app/lien/${id}`), getI18n()]);
  const { data: principle } = await supabase.from("principles").select("id, then_text, proof_type, target").eq("id", id).maybeSingle();
  if (!principle) notFound();
  if (principle.proof_type !== "lien") redirect("/app");
  const domains = (principle.target as { domains?: string[] }).domains ?? [];
  return (
    <main className="relative isolate mx-auto min-h-dvh w-full max-w-xl overflow-x-clip px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <Aura tone="sky" />
      <BackLink />
      <h1 className="mt-5 font-display text-[30px] leading-tight text-balance">{principle.then_text}</h1>
      <p className="mt-3 text-sm text-mute">{m.app.proofs.linkDetail}</p>
      <div className="mt-8">
        <LinkForm mode="principle" targetId={id} domains={domains} />
      </div>
    </main>
  );
}
