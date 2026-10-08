"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { billing, checkoutDestination, portalUrl } from "@/lib/checkout";
import { rateLimit } from "@/lib/rate-limit";
import { stripeConfigured } from "@/lib/stripe";

export type CheckoutState = { error: string | null };

const Input = z.object({
  plan: z.enum(["arc", "pro", "fondateur"]),
  interval: z.enum(["once", "month", "year", "lifetime"]),
  waiver: z.literal("on"),
});

/** Plan choisi depuis la page des plans (utilisateur connecté, arc déjà construit). */
export async function startCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const { user } = await getUser();
  if (!user) redirect("/onboarding");
  const { m, locale } = await getI18n();
  if (!(await rateLimit("checkout", 10, 600))) return { error: m.actions.tooMany };

  if (formData.get("waiver") !== "on") return { error: m.actions.onboarding.waiver };
  const parsed = Input.safeParse({ plan: formData.get("plan"), interval: formData.get("interval"), waiver: formData.get("waiver") });
  if (!parsed.success) return { error: m.actions.checkout.invalid };

  const b = await billing(user.id);
  if (!b) redirect(`/onboarding?plan=${parsed.data.plan}`);
  if (parsed.data.plan === "arc" && !b.has_open && b.arc_credits === 0 && b.effective_plan === null) {
    // Un Arc 90 jours se rattache à un arc : on le construit d'abord (2 minutes).
    redirect("/onboarding?plan=arc");
  }

  const result = await checkoutDestination(user.id, { plan: parsed.data.plan, interval: parsed.data.interval }, locale);
  if ("error" in result) return { error: m.actions.checkout[result.error] };
  if ("covered" in result) redirect("/app");
  redirect(result.url);
}

/** Portail Stripe : changer de plan, de carte, résilier, télécharger ses factures. */
export async function openBillingPortal(): Promise<void> {
  const { user } = await getUser();
  if (!user) redirect("/login?next=/app/profil");
  if (!stripeConfigured()) redirect("/app/profil?portail=indisponible");
  const b = await billing(user.id);
  if (!b?.stripe_customer_id) redirect("/abonnement");
  const url = await portalUrl(b.stripe_customer_id, (await getI18n()).locale);
  redirect(url ?? "/app/profil?portail=indisponible");
}
