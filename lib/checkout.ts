import "server-only";
import { cookies } from "next/headers";
import type Stripe from "stripe";
import { siteUrl } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import { getMessages, type Messages } from "@/lib/i18n/messages";
import { getStripe, stripeConfigured, stripeLive } from "@/lib/stripe";
import { ensureCoupons, LOYALTY_COUPON, REFERRAL_COUPON } from "@/lib/stripe-codes";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Interval, PlanId, PublicPlans } from "@/lib/types";
import { parseUtm, UTM_COOKIE } from "@/lib/utm";

// Paiement : Arc 90 jours (une fois par arc), Pro (abonnement), Fondateur (une fois, à vie).

/** Clé du message d'erreur (actions.checkout), traduit par l'appelant. */
export type CheckoutError = keyof Omit<Messages["actions"]["checkout"], "stripeNotice">;

export type Choice = { plan: PlanId; interval: Interval };

/** Plan et période cohérents : Arc 90 jours une fois, Pro au mois ou à l'année, Fondateur à vie. */
export function validChoice(plan: PlanId, interval: Interval): boolean {
  if (plan === "arc") return interval === "once";
  if (plan === "fondateur") return interval === "lifetime";
  return interval === "month" || interval === "year";
}

export type Billing = {
  email: string | null;
  pseudo: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
  plan_status: string | null;
  effective_plan: string | null;
  has_open: boolean;
  arc_paid: boolean;
  arc_credits: number;
  loyalty_pending: boolean;
  referral_rewards: number;
  utm_source: string | null;
  utm_campaign: string | null;
};

/** Lien de parrainage d'un ami (code gardé dans le cookie de source) : son code promo, si c'est le premier paiement. */
export async function referralPromo(userId: string | null, code: string | null | undefined): Promise<{ promotion_code_id: string; pseudo: string } | null> {
  if (!code) return null;
  const { data } = await createAdminClient().rpc("referral_promo_for", { p_user: userId, p_code: code });
  return (data as { promotion_code_id: string; pseudo: string } | null) ?? null;
}

/** La remise qui s'appliquera au paiement (même ordre que checkoutDestination), pour l'afficher avant. */
export async function upcomingDiscount(
  userId: string,
  plan: PlanId,
  b: Billing | null,
): Promise<{ percent: number; kind: "loyalty" | "reward" | "friend"; pseudo: string | null } | null> {
  if (plan === "arc" && b?.loyalty_pending) return { percent: 50, kind: "loyalty", pseudo: null };
  if (plan === "arc" && (b?.referral_rewards ?? 0) > 0) return { percent: 20, kind: "reward", pseudo: null };
  const utm = parseUtm((await cookies()).get(UTM_COOKIE)?.value);
  const source = b?.utm_source ?? utm.source;
  const campaign = b?.utm_campaign ?? utm.campaign;
  const friend = await referralPromo(userId, source === "parrainage" ? campaign : null);
  return friend ? { percent: 20, kind: "friend", pseudo: friend.pseudo } : null;
}

export async function billing(userId: string): Promise<Billing | null> {
  const { data } = await createAdminClient().rpc("billing_profile", { p_user: userId });
  return (data as Billing | null) ?? null;
}

/** Client Stripe de l'utilisateur, créé une seule fois (et recréé s'il vient du mode test, inconnu en live). */
async function ensureCustomer(userId: string, b: Billing): Promise<string> {
  if (b.stripe_customer_id) {
    const known = await getStripe()
      .customers.retrieve(b.stripe_customer_id)
      .then((c) => !c.deleted)
      .catch(() => false);
    if (known) return b.stripe_customer_id;
  }
  const customer = await getStripe().customers.create(
    { email: b.email ?? undefined, name: b.pseudo, metadata: { user_id: userId } },
    { idempotencyKey: `customer-${userId}-${stripeLive() ? "live" : "test"}` },
  );
  await createAdminClient().rpc("set_stripe_customer", { p_user: userId, p_customer: customer.id });
  return customer.id;
}

export async function portalUrl(customer: string, locale: Locale = "fr"): Promise<string | null> {
  const admin = createAdminClient();
  const { data: setting } = await admin.from("settings").select("value").eq("key", stripeLive() ? "stripe_portal_live" : "stripe_portal").maybeSingle();
  const configuration = typeof setting?.value === "string" ? setting.value : undefined;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: `${siteUrl()}/app/profil`,
      locale,
      ...(configuration ? { configuration } : {}),
    });
    return session.url;
  } catch (e) {
    console.error(`[portail] ouverture impossible : ${e instanceof Error ? e.name : "erreur"}`);
    return null;
  }
}

/**
 * Où envoyer l'utilisateur pour payer le plan choisi : Stripe Checkout, le portail (abonnement Pro déjà actif),
 * ou rien à payer (son plan couvre déjà l'arc). Prix lus en base, jamais envoyés par le client.
 */
export async function checkoutDestination(
  userId: string,
  { plan, interval }: Choice,
  locale: Locale = "fr",
): Promise<{ url: string } | { covered: true } | { error: CheckoutError }> {
  if (!validChoice(plan, interval)) return { error: "invalid" };
  if (!stripeConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "unavailable" };

  const b = await billing(userId);
  if (!b) return { error: "buildFirst" };
  if (b.effective_plan === "fondateur") return plan === "fondateur" ? { error: "lifetime" } : { covered: true };
  if (plan === "arc") {
    if (b.effective_plan === "pro") return { covered: true };
    if (b.arc_paid || b.arc_credits > 0) return { covered: true };
  }

  // Abonnement Pro en cours : changement de période dans le portail Stripe (prorata géré par Stripe).
  if (plan === "pro" && b.stripe_customer_id && b.stripe_subscription_id && ["active", "trialing", "past_due"].includes(b.plan_status ?? "")) {
    const url = await portalUrl(b.stripe_customer_id, locale);
    return url ? { url } : { error: "unavailable" };
  }

  const admin = createAdminClient();
  const [{ data: price }, { data: plans }] = await Promise.all([
    admin.rpc("plan_price", { p_plan: plan, p_interval: interval }),
    admin.rpc("plans_public"),
  ]);
  const entry = price as { price_id: string | null; live_price_id?: string | null } | null;
  const priceId = stripeLive() ? entry?.live_price_id : entry?.price_id;
  if (!priceId) return { error: "unavailable" };
  const p = plans as PublicPlans | null;
  if (plan === "fondateur" && p && p.fondateur.sold >= p.fondateur.limit) return { error: "soldOut" };

  const utm = parseUtm((await cookies()).get(UTM_COOKIE)?.value);
  const metadata: Record<string, string> = { user_id: userId, plan, interval, waiver: "acces_immediat" };
  const source = b.utm_source ?? utm.source;
  const campaign = b.utm_campaign ?? utm.campaign;
  if (source) metadata.utm_source = source;
  if (campaign) metadata.utm_campaign = campaign;
  // Une seule remise par paiement (Stripe n'accepte pas de code promo en plus), dans cet ordre :
  // fidélité (−50 % sur l'Arc 90 jours), remise de parrain gagnée (−20 %), lien de parrainage d'un ami (−20 %).
  const loyalty = plan === "arc" && b.loyalty_pending;
  const reward = !loyalty && plan === "arc" && b.referral_rewards > 0;
  const friend = loyalty || reward ? null : await referralPromo(userId, source === "parrainage" ? campaign : null);
  if (loyalty) metadata.loyalty = "1";
  if (reward) metadata.referral_reward = "1";

  try {
    const customer = await ensureCustomer(userId, b);
    const oneTime = plan !== "pro";
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: oneTime ? "payment" : "subscription",
      customer,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      locale,
      metadata,
      custom_text: { submit: { message: getMessages(locale).actions.checkout.stripeNotice } },
      success_url: `${siteUrl()}/app?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/abonnement?annule=1`,
    };
    if (loyalty || reward) {
      await ensureCoupons();
      params.discounts = [{ coupon: loyalty ? LOYALTY_COUPON : REFERRAL_COUPON }];
    } else if (friend) {
      params.discounts = [{ promotion_code: friend.promotion_code_id }];
    } else {
      params.allow_promotion_codes = true;
    }
    if (oneTime) {
      params.payment_intent_data = { metadata };
      params.invoice_creation = { enabled: true };
    } else {
      params.subscription_data = { metadata };
    }
    const session = await getStripe().checkout.sessions.create(params);
    if (session.url) return { url: session.url };
  } catch (e) {
    console.error(`[checkout] session Stripe impossible : ${e instanceof Error ? e.name : "inconnue"}`);
  }
  return { error: "failed" };
}

