import type { Metadata } from "next";
import Link from "next/link";
import { ArtBand } from "@/components/Art";
import { Faq } from "@/components/Faq";
import { Hand } from "@/components/Hand";
import { Logo } from "@/components/Logo";
import { PlanPicker } from "@/components/PlanPicker";
import { SiteFooter } from "@/components/SiteFooter";
import { SocialProof } from "@/components/SocialProof";
import { IMAGES } from "@/lib/art";
import { getUser } from "@/lib/auth";
import { FAQ } from "@/lib/faq";
import type { PlanId, PublicPlans, SocialProof as Proof } from "@/lib/types";
import { btnLink, label } from "@/lib/ui";

export const metadata: Metadata = {
  title: "Plans",
  description: "Arc 90 jours à 19,99 € une fois, Pro ou Fondateur. Payer, c'est déjà s'engager.",
};

export default async function SubscriptionPage({ searchParams }: PageProps<"/abonnement">) {
  const params = await searchParams;
  const { supabase, user } = await getUser();
  const [{ data: plans }, { data: proof }, profile] = await Promise.all([
    supabase.rpc("plans_public"),
    supabase.rpc("social_proof"),
    user ? supabase.from("profiles").select("id").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  let current: PlanId | null = null;
  let hasArc = false;
  if (user && profile.data) {
    const [{ data }, { data: open }] = await Promise.all([
      supabase.rpc("my_plan"),
      supabase.from("enrollments").select("id").eq("user_id", user.id).in("status", ["draft", "active"]).maybeSingle(),
    ]);
    current = ((data as { plan: PlanId | null } | null)?.plan ?? null) as PlanId | null;
    hasArc = Boolean(open);
  }
  // Un plan se paie pour un arc construit ; sinon, on passe d'abord par le questionnaire.
  const mode = user && profile.data && (hasArc || current) ? ({ kind: "checkout" } as const) : ({ kind: "link" } as const);
  const pricing = FAQ.find((g) => g.title === "Prix et paiement")?.items ?? [];

  return (
    <>
      <main className="mx-auto min-h-dvh w-full max-w-xl px-5 pt-6 pb-16">
        <Link href={user ? "/app" : "/"} aria-label="Nonante">
          <Logo size="sm" />
        </Link>
        <ArtBand slug={IMAGES.paywall} className="-mx-5 mt-6 h-64">
          <p className={label}>Plans</p>
          <h1 className="mt-2 font-serif text-5xl leading-[0.95]">Payer, c&apos;est déjà s&apos;engager.</h1>
        </ArtBand>

        {params.annule === "1" ? (
          <p role="status" className="mt-6 animate-rise border border-line p-4 text-sm">
            Paiement annulé, rien n&apos;a été prélevé. Ton arc est enregistré : il t&apos;attend.
          </p>
        ) : null}

        <p className="mt-6 text-lg leading-relaxed text-paper/85">
          Un arc gratuit, on le lâche. Un arc payé, on le tient. L&apos;Arc 90 jours, c&apos;est{" "}
          <Hand className="text-2xl">un seul paiement</Hand> pour 90 jours de preuves, sans abonnement caché.
        </p>

        {mode.kind === "link" ? (
          <p className="mt-6 text-sm text-mute">
            D&apos;abord,{" "}
            <Link href="/onboarding" className={btnLink}>
              construis ton arc
            </Link>{" "}
            : 2 minutes de questions, et tu vois tes principes avant de payer.
          </p>
        ) : null}

        <div className="mt-10">
          {plans ? <PlanPicker plans={plans as PublicPlans} current={current} mode={mode} /> : <p className="text-mute">Plans indisponibles.</p>}
        </div>

        <p className="mt-6 text-xs text-mute">
          Prix TTC. Paiement sécurisé par Stripe. Codes promo acceptés à l&apos;étape suivante.{" "}
          <Link href="/legal/cgv" className="underline underline-offset-2">
            Conditions générales de vente
          </Link>
          .
        </p>

        <section className="mt-16">
          <SocialProof proof={proof as Proof | null} compact />
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl">Questions</h2>
          <div className="mt-6">
            <Faq items={pricing} />
          </div>
          <Link href="/faq" className={`${btnLink} mt-6 inline-block`}>
            Toutes les questions
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
