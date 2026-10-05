import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutPassForm } from "@/app/checkout/CheckoutPassForm";
import { Logo } from "@/components/Logo";
import { requireUser } from "@/lib/auth";
import { currentPrice } from "@/lib/cohorts";
import { formatRangeFr } from "@/lib/dates";
import { formatEuros } from "@/lib/money";
import { btnLink } from "@/lib/ui";

export const metadata: Metadata = { title: "Paiement", robots: { index: false } };

export default async function CheckoutPage() {
  const { supabase, user } = await requireUser("/checkout");

  // Prévente payée avec le même email : rattachée tout de suite, sans second paiement.
  const { data: claimed } = await supabase.rpc("claim_presale");
  if (claimed) redirect("/app?paid=1");

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, cohort_id")
    .eq("user_id", user.id)
    .eq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!enrollment) redirect("/app");

  const [{ data: cohort }, { count }] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id, name, start_date, end_date, price_cents, early_price_cents")
      .eq("id", enrollment.cohort_id)
      .single(),
    supabase.from("principles").select("id", { count: "exact", head: true }).eq("enrollment_id", enrollment.id),
  ]);
  if (!cohort) redirect("/onboarding");
  const price = currentPrice(cohort);
  const stake = process.env.FEATURE_STAKE === "true";

  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-5 pt-6 pb-16">
      <Logo size="sm" />
      <p className="mt-14 text-xs tracking-[0.2em] text-mute uppercase">Pass d&apos;arc</p>
      <h1 className="mt-4 font-serif text-5xl leading-none">{cohort.name}</h1>
      <p className="mt-4 text-mute">
        {formatRangeFr(cohort.start_date, cohort.end_date)}. {count ?? 0} principes, une
        épreuve par semaine, le classement.
      </p>

      <div className="mt-10 border-t border-line pt-10">
        <div className="flex items-baseline gap-4">
          <span className="font-serif text-6xl leading-none">{formatEuros(price.cents)}</span>
          {price.early && cohort.price_cents > price.cents ? (
            <span className="text-xl text-mute line-through">{formatEuros(cohort.price_cents)}</span>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-mute">
          {price.early ? "Prix early bird jusqu'au départ. " : null}Paiement unique, pas d&apos;abonnement. Codes promo
          (parrainage, fidélité) acceptés sur la page de paiement.
        </p>
        <div className="mt-8">
          <CheckoutPassForm label={`Payer ${formatEuros(price.cents)}`} />
        </div>
        {stake ? (
          <p className="mt-6 text-sm text-mute">
            Mise sur soi : après le paiement, tu pourras miser sur toi-même depuis ton tableau de bord, avant le départ.
          </p>
        ) : null}
        <p className="mt-6 text-xs text-mute">
          En payant, tu acceptes les <Link href="/legal/cgv" className="underline underline-offset-4">CGV</Link>.
        </p>
      </div>

      <Link href="/onboarding/principes" className={`${btnLink} mt-10 inline-block`}>
        Revoir mes principes
      </Link>
    </main>
  );
}
