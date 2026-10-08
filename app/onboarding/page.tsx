import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { type CollectiveStart, Quiz } from "@/app/onboarding/Quiz";
import { Faq } from "@/components/Faq";
import { Founder } from "@/components/Founder";
import { SocialProof } from "@/components/SocialProof";
import { getArt, IMAGES } from "@/lib/art";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { referralPromo } from "@/lib/checkout";
import { parseUtm, UTM_COOKIE } from "@/lib/utm";
import { todayParis } from "@/lib/dates";
import { faqItems } from "@/lib/faq";
import { getI18n } from "@/lib/i18n/server";
import type { PlanId, PublicPlans, SocialProof as Proof } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.quiz.meta.title, description: m.quiz.meta.description };
}

// Les objections qui arrivent au moment de payer.
const OBJECTIONS = ["payant", "renouvellement", "choisir", "temps", "triche", "retractation"];

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const params = await searchParams;
  const [{ supabase, user }, { m }] = await Promise.all([getUser(), getI18n()]);
  const today = todayParis();

  const [{ data: plans }, { data: proof }, { data: starts }] = await Promise.all([
    supabase.rpc("plans_public"),
    supabase.rpc("social_proof"),
    supabase.rpc("collective_starts"),
  ]);

  let pseudo: string | null = null;
  let arcNumber = 1;
  let currentPlan: PlanId | null = null;
  if (user) {
    const [{ data: profile }, { data: enrollments }] = await Promise.all([
      supabase.from("profiles").select("pseudo").eq("id", user.id).maybeSingle(),
      supabase.from("enrollments").select("arc_number, status, start_date").eq("user_id", user.id).order("arc_number", { ascending: false }),
    ]);
    // Arc en cours (jour 1 passé) : il se pilote depuis le tableau de bord.
    const open = (enrollments ?? []).find((e) => e.status === "draft" || e.status === "active");
    if (open && open.status === "active" && open.start_date <= today) redirect("/app");
    pseudo = profile?.pseudo ?? null;
    arcNumber = open ? open.arc_number : (enrollments?.[0]?.arc_number ?? 0) + 1;
    if (profile) {
      const { data: plan } = await supabase.rpc("my_plan");
      currentPlan = ((plan as { plan: PlanId | null } | null)?.plan ?? null) as PlanId | null;
    }
  }

  // Arrivé par le lien d'un ami : −20 % sur le premier paiement, annoncé avant les plans.
  const utm = parseUtm((await cookies()).get(UTM_COOKIE)?.value);
  const friend = utm.source === "parrainage" ? await referralPromo(user?.id ?? null, utm.campaign) : null;

  const initialPlan = params.plan === "pro" || params.plan === "arc" || params.plan === "fondateur" ? (params.plan as PlanId) : null;
  const socialProof = proof as Proof | null;

  return (
    <Quiz
      loggedIn={Boolean(user)}
      hasProfile={Boolean(pseudo)}
      pseudo={pseudo}
      today={today}
      collectiveStarts={(starts as CollectiveStart[] | null) ?? []}
      arcNumber={arcNumber}
      plans={plans as PublicPlans}
      currentPlan={currentPlan}
      initialPlan={initialPlan}
      arts={IMAGES.onboarding.map((slug) => getArt(slug))}
      templates={socialProof?.templates ?? 84}
      invitedBy={friend?.pseudo ?? null}
      founderSlot={<Founder compact />}
      proofSlot={<SocialProof proof={socialProof} compact />}
      faqSlot={<Faq items={faqItems(OBJECTIONS, m)} />}
    />
  );
}
