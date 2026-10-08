import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SuiteForm } from "@/app/onboarding/suite/SuiteForm";
import { Hand } from "@/components/Hand";
import { Logo } from "@/components/Logo";
import { Answers, startDateOf } from "@/lib/answers";
import { requireUser } from "@/lib/auth";
import { billing, upcomingDiscount } from "@/lib/checkout";
import { todayParis } from "@/lib/dates";
import { fmt, formatDay, formatMoney } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Interval, PlanId, PublicPlans } from "@/lib/types";
import { label } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.quiz.suite.title, robots: { index: false } };
}

export default async function SuitePage() {
  const [{ supabase, user }, { m, locale }] = await Promise.all([requireUser("/onboarding/suite"), getI18n()]);
  const t = m.quiz.suite;
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
  const startLabel = a.start.startsWith("squad:") ? t.collective : formatDay(start.date, locale, { weekday: true, year: false });
  const priceText = (cents: number) => fmt(m.game.plans.price[interval], { price: formatMoney(cents, locale) }, locale);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-14 grain">
      <Logo size="sm" />
      <div className="my-auto py-12">
        <Hand underline className="animate-rise text-3xl">
          {t.hand}
        </Hand>
        <h1 className="mt-6 animate-rise font-serif text-5xl leading-[0.95] [animation-delay:80ms]">{t.heading}</h1>

        <dl className="mt-8 animate-rise divide-y divide-line border-y border-line text-sm [animation-delay:160ms]">
          <div className="py-4">
            <dt className={label}>{t.goal}</dt>
            <dd className="mt-1.5 font-serif text-2xl leading-tight">{a.goal}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-4">
            <dt className={label}>{t.day1}</dt>
            <dd>{startLabel}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-4">
            <dt className={label}>{m.game.plans.name[plan]}</dt>
            <dd className="font-serif text-2xl">{covered ? t.included : priceText(price)}</dd>
          </div>
          {discount ? (
            <>
              <div className="flex items-baseline justify-between gap-4 py-4">
                <dt className={label}>{fmt(t.discount[discount.kind], { name: discount.pseudo })}</dt>
                <dd>−{discount.percent} %</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-4">
                <dt className={label}>{t.toPay}</dt>
                <dd className="font-serif text-3xl">{formatMoney(total, locale)}</dd>
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
            cta={covered ? t.launch : fmt(t.pay, { price: interval === "once" ? formatMoney(total, locale) : priceText(total) })}
            currentYear={Number(today.slice(0, 4))}
          />
        </div>
      </div>
    </main>
  );
}
