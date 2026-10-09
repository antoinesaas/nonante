import "server-only";
import type Stripe from "stripe";
import { z } from "zod";
import { sendReferralReward, sendWelcome } from "@/lib/emails";
import { localeOf } from "@/lib/i18n/user";
import { getStripe } from "@/lib/stripe";
import { applyReferralDiscount } from "@/lib/stripe-codes";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Interval, PlanId } from "@/lib/types";

// Arc 90 jours (paiement unique par arc), abonnement Pro et Fondateur (paiement unique, à vie).
// Appelé par le webhook ET au retour de Stripe : tout est idempotent (grant_arc_pass, sync_subscription,
// record_payment, record_referral).

type PlansSetting = Record<string, Record<string, { amount: number; price_id: string | null; live_price_id?: string | null }>>;

export function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Plans et identifiants de prix Stripe, lus en base (réglage « plans »). */
export async function plansSetting(): Promise<PlansSetting> {
  const { data, error } = await createAdminClient().from("settings").select("value").eq("key", "plans").single();
  if (error) throw new Error(`plans illisibles (${error.code})`);
  return data.value as PlansSetting;
}

/** Retrouve le plan et la période à partir d'un identifiant de prix Stripe. */
export async function planFromPrice(priceId: string | null | undefined): Promise<{ plan: PlanId; interval: Interval } | null> {
  if (!priceId) return null;
  const plans = await plansSetting();
  for (const [plan, intervals] of Object.entries(plans)) {
    for (const [interval, entry] of Object.entries(intervals)) {
      if (entry && typeof entry === "object" && (entry.price_id === priceId || entry.live_price_id === priceId)) {
        return { plan: plan as PlanId, interval: interval as Interval };
      }
    }
  }
  return null;
}

/** Abonnement Stripe → profil (plan, statut, fin de période). Renvoie l'utilisateur concerné. */
export async function syncSubscription(subscription: Stripe.Subscription, userHint?: string | null): Promise<string | null> {
  const item = subscription.items.data[0];
  const mapped = await planFromPrice(item?.price?.id);
  const metadataUser = z.uuid().safeParse(subscription.metadata?.user_id);
  const { data, error } = await createAdminClient().rpc("sync_subscription", {
    p_user: userHint ?? (metadataUser.success ? metadataUser.data : null),
    p_customer: idOf(subscription.customer) ?? "",
    p_subscription: subscription.id,
    p_plan: mapped?.plan ?? (subscription.metadata?.plan as string | undefined) ?? "",
    p_interval: mapped?.interval ?? item?.price?.recurring?.interval ?? "",
    p_status: subscription.status,
    p_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    p_cancel_at_period_end: subscription.cancel_at_period_end,
  });
  if (error) throw new Error(`synchronisation de l'abonnement impossible (${error.code})`);
  return (data as string | null) ?? null;
}

/**
 * Vente parrainée : le parrain gagne −20 % lui aussi. Abonné Pro : sur sa prochaine facture ;
 * sinon (ou si sa facture a déjà une remise) : gardé pour son prochain Arc 90 jours. Une seule fois par filleul.
 */
async function rewardReferral(session: Stripe.Checkout.Session, userId: string) {
  const promo = idOf(session.discounts?.find((d) => d.promotion_code)?.promotion_code);
  if (!promo) return;
  const admin = createAdminClient();
  const { data } = await admin.rpc("record_referral", { p_promotion_code_id: promo, p_referred: userId, p_object_id: session.id });
  const referral = data as { referrer_id: string; subscription_id: string | null; email: string | null } | null;
  if (!referral) return;
  let onSubscription = false;
  if (referral.subscription_id) {
    try {
      onSubscription = await applyReferralDiscount(referral.subscription_id);
    } catch (e) {
      console.error(`[paiement] remise de parrainage sur l'abonnement impossible : ${e instanceof Error ? e.name : "erreur"}`);
    }
  }
  if (!onSubscription) await admin.rpc("add_referral_reward", { p_user: referral.referrer_id });
  await admin.rpc("mark_referral_rewarded", { p_referred: userId, p_cents: 0 });
  if (referral.email) {
    const { data: first } = await admin.rpc("log_email_once", { p_user: referral.referrer_id, p_kind: "referral", p_ref: userId });
    if (first) await sendReferralReward(referral.email, onSubscription, await localeOf(admin, referral.referrer_id));
  }
}

/** Checkout terminé : Arc 90 jours rattaché à l'arc, abonnement synchronisé, ou accès à vie (Fondateur). */
export async function fulfillCheckout(session: Stripe.Checkout.Session): Promise<string | null> {
  const parsedUser = z.uuid().safeParse(session.client_reference_id ?? session.metadata?.user_id);
  if (!parsedUser.success) return null;
  const userId = parsedUser.data;
  const admin = createAdminClient();

  if (session.mode === "subscription") {
    const subscriptionId = idOf(session.subscription);
    if (!subscriptionId) return null;
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    await syncSubscription(subscription, userId);
  } else if (session.mode === "payment" && session.metadata?.plan === "arc") {
    if (session.payment_status !== "paid") return null;
    const { error } = await admin.rpc("grant_arc_pass", {
      p_user: userId,
      p_object_id: session.id,
      p_amount: session.amount_total ?? 0,
      p_currency: session.currency ?? "eur",
      p_customer: idOf(session.customer) ?? "",
      p_loyalty: session.metadata?.loyalty === "1",
      p_referral: session.metadata?.referral_reward === "1",
    });
    if (error) throw new Error(`Arc 90 jours impossible à rattacher (${error.code})`);
  } else if (session.mode === "payment" && session.metadata?.plan === "fondateur") {
    if (session.payment_status !== "paid") return null;
    const { error } = await admin.rpc("grant_lifetime", { p_user: userId, p_customer: idOf(session.customer) ?? "" });
    if (error) throw new Error(`accès à vie impossible (${error.code})`);
    await admin.rpc("record_payment", {
      p_object_id: session.id, p_user: userId, p_kind: "lifetime", p_plan: "fondateur", p_interval: "lifetime",
      p_amount: session.amount_total ?? 0, p_currency: session.currency ?? "eur",
    });
  } else {
    return null;
  }

  try {
    await rewardReferral(session, userId);
  } catch (e) {
    console.error(`[paiement] crédit de parrainage impossible : ${e instanceof Error ? e.name : "erreur"}`);
  }

  const email = session.customer_details?.email ?? session.customer_email;
  if (email) {
    const { data: first } = await admin.rpc("log_email_once", { p_user: userId, p_kind: "welcome", p_ref: session.id });
    if (first) await sendWelcome(email, await localeOf(admin, userId));
  }
  return userId;
}

/** Facture d'abonnement payée : comptée dans le chiffre d'affaires (une seule fois). */
export async function recordInvoice(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.id || invoice.amount_paid <= 0) return;
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
  const priceLine = invoice.lines.data.find((l) => l.pricing?.price_details?.price);
  const mapped = await planFromPrice(idOf(priceLine?.pricing?.price_details?.price ?? null));
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .or(`stripe_customer_id.eq.${idOf(invoice.customer) ?? "-"}${subscriptionId ? `,stripe_subscription_id.eq.${subscriptionId}` : ""}`)
    .limit(1)
    .maybeSingle();
  await admin.rpc("record_payment", {
    p_object_id: invoice.id,
    p_user: profile?.id ?? null,
    p_kind: "subscription",
    p_plan: mapped?.plan ?? "",
    p_interval: mapped?.interval ?? "",
    p_amount: invoice.amount_paid,
    p_currency: invoice.currency,
  });
}
