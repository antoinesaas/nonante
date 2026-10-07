import "server-only";
import { cookies } from "next/headers";
import type Stripe from "stripe";
import { siteUrl } from "@/lib/env";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { ensureCoupons, LOYALTY_COUPON } from "@/lib/stripe-codes";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Interval, PlanId, PublicPlans } from "@/lib/types";
import { parseUtm, UTM_COOKIE } from "@/lib/utm";

// Paiement : Arc 90 jours (une fois par arc), Pro (abonnement), Fondateur (une fois, à vie).

export const UNAVAILABLE = "Le paiement n'est pas encore disponible. Réessaie plus tard.";

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
  utm_source: string | null;
  utm_campaign: string | null;
};

export async function billing(userId: string): Promise<Billing | null> {
  const { data } = await createAdminClient().rpc("billing_profile", { p_user: userId });
  return (data as Billing | null) ?? null;
}

/** Client Stripe de l'utilisateur, créé une seule fois. */
async function ensureCustomer(userId: string, b: Billing): Promise<string> {
  if (b.stripe_customer_id) return b.stripe_customer_id;
  const customer = await getStripe().customers.create(
    { email: b.email ?? undefined, name: b.pseudo, metadata: { user_id: userId } },
    { idempotencyKey: `customer-${userId}` },
  );
  await createAdminClient().rpc("set_stripe_customer", { p_user: userId, p_customer: customer.id });
  return customer.id;
}

export async function portalUrl(customer: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: setting } = await admin.from("settings").select("value").eq("key", "stripe_portal").maybeSingle();
  const configuration = typeof setting?.value === "string" ? setting.value : undefined;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: `${siteUrl()}/app/profil`,
      locale: "fr",
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
): Promise<{ url: string } | { covered: true } | { error: string }> {
  if (!validChoice(plan, interval)) return { error: "Choix invalide." };
  if (!stripeConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: UNAVAILABLE };

  const b = await billing(userId);
  if (!b) return { error: "Construis d'abord ton arc." };
  if (b.effective_plan === "fondateur") return plan === "fondateur" ? { error: "Tu as déjà l'accès à vie." } : { covered: true };
  if (plan === "arc") {
    if (b.effective_plan === "pro") return { covered: true };
    if (b.arc_paid || b.arc_credits > 0) return { covered: true };
  }

  // Abonnement Pro en cours : changement de période dans le portail Stripe (prorata géré par Stripe).
  if (plan === "pro" && b.stripe_customer_id && b.stripe_subscription_id && ["active", "trialing", "past_due"].includes(b.plan_status ?? "")) {
    const url = await portalUrl(b.stripe_customer_id);
    return url ? { url } : { error: UNAVAILABLE };
  }

  const admin = createAdminClient();
  const [{ data: price }, { data: plans }] = await Promise.all([
    admin.rpc("plan_price", { p_plan: plan, p_interval: interval }),
    admin.rpc("plans_public"),
  ]);
  const priceId = (price as { price_id: string | null } | null)?.price_id;
  if (!priceId) return { error: UNAVAILABLE };
  const p = plans as PublicPlans | null;
  if (plan === "fondateur" && p && p.fondateur.sold >= p.fondateur.limit) return { error: "Les 100 places Fondateur sont parties." };

  const utm = parseUtm((await cookies()).get(UTM_COOKIE)?.value);
  const metadata: Record<string, string> = { user_id: userId, plan, interval, waiver: "acces_immediat" };
  const source = b.utm_source ?? utm.source;
  const campaign = b.utm_campaign ?? utm.campaign;
  if (source) metadata.utm_source = source;
  if (campaign) metadata.utm_campaign = campaign;
  // Fidélité sans abonnement : −50 % sur cet Arc 90 jours (Stripe n'accepte pas de code promo en plus).
  const loyalty = plan === "arc" && b.loyalty_pending;
  if (loyalty) metadata.loyalty = "1";

  try {
    const customer = await ensureCustomer(userId, b);
    const oneTime = plan !== "pro";
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: oneTime ? "payment" : "subscription",
      customer,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      locale: "fr",
      metadata,
      custom_text: {
        submit: {
          message:
            "Tu demandes l'accès immédiat. En cas de rétractation dans les 14 jours, le service déjà fourni reste dû au prorata.",
        },
      },
      success_url: `${siteUrl()}/app?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/abonnement?annule=1`,
    };
    if (loyalty) {
      await ensureCoupons();
      params.discounts = [{ coupon: LOYALTY_COUPON }];
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
  return { error: "Le paiement n'a pas pu démarrer. Réessaie dans un instant." };
}

