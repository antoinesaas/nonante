"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicPlans } from "@/lib/types";
import { parseUtm, UTM_COOKIE } from "@/lib/utm";

export type CheckoutState = { error: string | null };

const UNAVAILABLE = "Le paiement n'est pas encore disponible. Réessaie plus tard.";

const Input = z.object({
  plan: z.enum(["essentiel", "pro", "fondateur"]),
  interval: z.enum(["month", "year", "lifetime"]),
  waiver: z.literal("on", { error: "Coche la case pour démarrer tout de suite." }),
});

type Billing = {
  email: string | null;
  pseudo: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
  plan_status: string | null;
  effective_plan: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
};

async function billing(userId: string): Promise<Billing | null> {
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

async function portalUrl(customer: string): Promise<string | null> {
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

/** Plan choisi : abonnement mensuel ou annuel, ou Fondateur (paiement unique). Prix lus en base, jamais envoyés par le client. */
export async function startCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const { user } = await getUser();
  if (!user) redirect("/login?next=/abonnement");
  if (!stripeConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: UNAVAILABLE };
  if (!(await rateLimit("checkout", 10, 600))) return { error: "Trop de tentatives. Réessaie dans quelques minutes." };

  const parsed = Input.safeParse({ plan: formData.get("plan"), interval: formData.get("interval"), waiver: formData.get("waiver") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choix invalide." };
  const { plan, interval } = parsed.data;
  if ((plan === "fondateur") !== (interval === "lifetime")) return { error: "Choix invalide." };

  const b = await billing(user.id);
  if (!b) redirect("/onboarding");
  if (b.effective_plan === "fondateur") return { error: "Tu as déjà l'accès à vie." };

  // Abonnement en cours : changement de plan ou de période dans le portail Stripe (prorata géré par Stripe).
  if (plan !== "fondateur" && b.stripe_customer_id && b.stripe_subscription_id && ["active", "trialing", "past_due"].includes(b.plan_status ?? "")) {
    const url = await portalUrl(b.stripe_customer_id);
    if (!url) return { error: UNAVAILABLE };
    redirect(url);
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
  const metadata: Record<string, string> = { user_id: user.id, plan, interval, waiver: "acces_immediat" };
  const source = b.utm_source ?? utm.source;
  const campaign = b.utm_campaign ?? utm.campaign;
  if (source) metadata.utm_source = source;
  if (campaign) metadata.utm_campaign = campaign;

  let url: string | null = null;
  try {
    const customer = await ensureCustomer(user.id, b);
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: plan === "fondateur" ? "payment" : "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      locale: "fr",
      metadata,
      custom_text: {
        submit: {
          message:
            "Tu demandes l'accès immédiat. En cas de rétractation dans les 14 jours, le service déjà fourni reste dû au prorata.",
        },
      },
      success_url: `${siteUrl()}/app?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/abonnement`,
    };
    if (plan === "fondateur") {
      params.payment_intent_data = { metadata };
      params.invoice_creation = { enabled: true };
    } else {
      params.subscription_data = { metadata };
    }
    const session = await getStripe().checkout.sessions.create(params);
    url = session.url;
  } catch (e) {
    console.error(`[checkout] session Stripe impossible : ${e instanceof Error ? e.name : "inconnue"}`);
  }
  if (!url) return { error: "Le paiement n'a pas pu démarrer. Réessaie dans un instant." };
  redirect(url);
}

/** Portail Stripe : changer de plan, de carte, résilier, télécharger ses factures. */
export async function openBillingPortal(): Promise<void> {
  const { user } = await getUser();
  if (!user) redirect("/login?next=/app/profil");
  if (!stripeConfigured()) redirect("/app/profil?portail=indisponible");
  const b = await billing(user.id);
  if (!b?.stripe_customer_id) redirect("/abonnement");
  const url = await portalUrl(b.stripe_customer_id);
  redirect(url ?? "/app/profil?portail=indisponible");
}
