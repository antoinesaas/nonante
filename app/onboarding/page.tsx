import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { type CollectiveStart, Quiz } from "@/app/onboarding/Quiz";
import { Faq } from "@/components/Faq";
import { SocialProof } from "@/components/SocialProof";
import { getArt, IMAGES } from "@/lib/art";
import { getUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";
import { faqItems } from "@/lib/faq";
import type { PlanId, PublicPlans, SocialProof as Proof } from "@/lib/types";

export const metadata: Metadata = {
  title: "Construis ton arc",
  description: "Deux minutes de questions, et Nonante construit ton arc de 90 jours : ton objectif, tes principes, ton jour 1.",
};

// Les objections qui arrivent au moment de payer.
const OBJECTIONS = ["payant", "renouvellement", "choisir", "temps", "triche", "retractation"];

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const params = await searchParams;
  const { supabase, user } = await getUser();
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
      templates={socialProof?.templates ?? 37}
      proofSlot={<SocialProof proof={socialProof} compact />}
      faqSlot={<Faq items={faqItems(OBJECTIONS)} />}
    />
  );
}
