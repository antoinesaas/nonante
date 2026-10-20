import type { Metadata } from "next";
import Link from "next/link";
import { Aura } from "@/components/Aura";
import { Faq } from "@/components/Faq";
import { Logo } from "@/components/Logo";
import { PlanPicker } from "@/components/PlanPicker";
import { SiteFooter } from "@/components/SiteFooter";
import { SocialProof } from "@/components/SocialProof";
import { getUser } from "@/lib/auth";
import { pricingFaq } from "@/lib/faq";
import { getI18n } from "@/lib/i18n/server";
import type { PlanId, PublicPlans, SocialProof as Proof } from "@/lib/types";
import { btnLink, label } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.pages.plans.metaTitle, description: m.pages.plans.metaDescription, alternates: { canonical: "/abonnement" } };
}

export default async function SubscriptionPage({ searchParams }: PageProps<"/abonnement">) {
  const params = await searchParams;
  const [{ supabase, user }, { m }] = await Promise.all([getUser(), getI18n()]);
  const t = m.pages.plans;
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

  return (
    <>
      <main className="relative isolate mx-auto min-h-dvh w-full max-w-xl overflow-x-clip px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-16 lg:max-w-5xl">
        <Aura tone="violet" className="h-[30rem]" />
        <Link href={user ? "/app" : "/"} aria-label={m.common.homeAria}>
          <Logo size="sm" />
        </Link>
        <p className={`${label} mt-10`}>{t.label}</p>
        <h1 className="mt-1 animate-in font-display text-[40px] leading-[1.02] lg:text-6xl">{t.title}</h1>

        {params.annule === "1" ? (
          <p role="status" className="card mt-6 animate-in p-4 text-sm">
            {t.cancelled}
          </p>
        ) : null}

        <p className="mt-4 text-[17px] leading-relaxed text-paper/85 lg:max-w-2xl">
          {t.intro} <span className="bg-linear-to-r from-[#b79bff] to-[#8358e8] bg-clip-text font-semibold text-transparent">{t.introHand}</span> {t.introEnd}
        </p>

        {mode.kind === "link" ? (
          <p className="mt-6 text-sm text-mute">
            {t.first}{" "}
            <Link href="/onboarding" className={btnLink}>
              {t.buildLink}
            </Link>{" "}
            {t.firstEnd}
          </p>
        ) : null}

        <div className="mt-8">
          {plans ? <PlanPicker plans={plans as PublicPlans} current={current} mode={mode} /> : <p className="text-mute">{t.unavailable}</p>}
        </div>

        <p className="mt-6 text-xs text-mute">
          {t.legal}{" "}
          <Link href="/legal/cgv" className="underline underline-offset-2">
            {t.sales}
          </Link>
          .
        </p>

        <div className="lg:mx-auto lg:max-w-3xl">
          <section className="mt-14">
            <SocialProof proof={proof as Proof | null} compact />
          </section>

          <section className="mt-14">
            <h2 className="font-display text-[26px]">{t.questions}</h2>
            <div className="mt-4">
              <Faq items={pricingFaq(m)} />
            </div>
            <Link href="/faq" className={`${btnLink} mt-6 inline-block`}>
              {m.common.actions.allQuestions}
            </Link>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
