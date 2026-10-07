import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SuiteForm } from "@/app/onboarding/suite/SuiteForm";
import { Hand } from "@/components/Hand";
import { Logo } from "@/components/Logo";
import { Answers, startDateOf } from "@/lib/answers";
import { requireUser } from "@/lib/auth";
import { billing, upcomingDiscount } from "@/lib/checkout";
import { formatEuros } from "@/lib/money";
import { formatDayFr, todayParis } from "@/lib/dates";
import { PLAN_NAME, priceLabel } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Interval, PlanId, PublicPlans } from "@/lib/types";
import { label } from "@/lib/ui";

export const metadata: Metadata = { title: "Dernière étape", robots: { index: false } };

export default async function SuitePage() {
  const { supabase, user } = await requireUser("/onboarding/suite");
  const email = user.email?.toLowerCase() ?? "";
  const { data: pending } = await createAdminClient()
    .from("pending_arcs")
    .select("answers, plan, plan_interval")
    .eq("email", email)
    .maybeSingle();

  const answers = Answers.safeParse(pending?.answers);
  if (!pending || !answers.success || !pending.plan || !pending.plan_interval) {
    // Rien en attente : arc déjà construit, ou questionnaire à refaire.
    const { data: open } = await supabase.from("enrollments").select("status").eq("user_id", user.id).in("status", ["draft", "active"]).maybeSingle();
    redirect(open?.status === "draft" ? "/abonnement" : open ? "/app" : "/onboarding");
  }
  const a = answers.data;
  const plan = pending.plan as PlanId;
  const interval = pending.plan_interval as Interval;

  const [{ data: profile }, { data: plansData }, b] = await Promise.all([
    supabase.from("profiles").select("pseudo").eq("id", user.id).maybeSingle(),
    supabase.rpc("plans_public"),
    billing(user.id),
  ]);
  const plans = plansData as PublicPlans;
  const price = plan === "arc" ? plans.arc.once : plan === "fondateur" ? plans.fondateur.lifetime : interval === "month" ? plans.pro.month : plans.pro.year;
  const covered =
    b?.effective_plan === "fondateur" ||
    (plan === "arc" && (b?.effective_plan === "pro" || Boolean(b?.arc_credits))) ||
    (plan === "pro" && b?.effective_plan === "pro");

  const discount = covered ? null : await upcomingDiscount(user.id, plan, b);
  const total = discount ? Math.round(price * (1 - discount.percent / 100)) : price;
  const today = todayParis();
  const start = startDateOf(a.start, today);
  const startLabel = a.start.startsWith("squad:") ? "départ collectif" : formatDayFr(start.date, { weekday: true, year: false });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-14 grain">
      <Logo size="sm" />
      <div className="my-auto py-12">
        <Hand underline className="animate-rise text-3xl">
          presque fini
        </Hand>
        <h1 className="mt-6 animate-rise font-serif text-5xl leading-[0.95] [animation-delay:80ms]">Dernière étape.</h1>

        <dl className="mt-8 animate-rise divide-y divide-line border-y border-line text-sm [animation-delay:160ms]">
          <div className="py-4">
            <dt className={label}>Objectif</dt>
            <dd className="mt-1.5 font-serif text-2xl leading-tight">{a.goal}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-4">
            <dt className={label}>Jour 1</dt>
            <dd>{startLabel}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-4">
            <dt className={label}>{PLAN_NAME[plan]}</dt>
            <dd className="font-serif text-2xl">{covered ? "déjà inclus" : priceLabel(price, interval)}</dd>
          </div>
          {discount ? (
            <>
              <div className="flex items-baseline justify-between gap-4 py-4">
                <dt className={label}>{discount.label}</dt>
                <dd>−{discount.percent} %</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-4">
                <dt className={label}>À payer</dt>
                <dd className="font-serif text-3xl">{formatEuros(total)}</dd>
              </div>
            </>
          ) : null}
        </dl>

        <div className="mt-8 animate-rise [animation-delay:240ms]">
          <SuiteForm
            needsProfile={!profile}
            pseudo={profile?.pseudo ?? a.pseudo ?? ""}
            isPublic={a.isPublic}
            needsPayment={!covered}
            cta={covered ? "Lancer mon arc" : `Payer ${priceLabel(total, interval).replace(" pour 90 jours", "")} et lancer mon arc`}
            currentYear={Number(today.slice(0, 4))}
          />
        </div>
      </div>
    </main>
  );
}
