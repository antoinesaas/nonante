import "server-only";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Remises commerciales identiques pour tous : jamais liées au classement.
export const REFERRAL_COUPON = "nonante-parrainage-20";
export const LOYALTY_COUPON = "nonante-fidelite-50";

async function ensureCoupon(id: string, percentOff: number, name: string): Promise<void> {
  const stripe = getStripe();
  try {
    await stripe.coupons.retrieve(id);
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode !== 404) throw e;
    await stripe.coupons.create({ id, percent_off: percentOff, duration: "once", name });
  }
}

export async function ensureCoupons(): Promise<void> {
  await ensureCoupon(REFERRAL_COUPON, 20, "Parrainage Nonante (−20 %)");
  await ensureCoupon(LOYALTY_COUPON, 50, "Fidélité Nonante (−50 %)");
}

/**
 * Code de parrainage personnel : −20 % pour un ami, réservé à un premier achat.
 * Idempotent : réutilise le code s'il existe déjà chez Stripe.
 */
export async function ensureReferralCode(userId: string, code: string): Promise<boolean> {
  if (!stripeConfigured()) return false;
  const stripe = getStripe();
  await ensureCoupon(REFERRAL_COUPON, 20, "Parrainage Nonante (−20 %)");
  const existing = await stripe.promotionCodes.list({ code, limit: 1 });
  let promo = existing.data[0];
  if (promo && promo.metadata?.referrer_id !== userId) return false;
  promo ??= await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: REFERRAL_COUPON },
    code,
    metadata: { nonante: "referral", referrer_id: userId },
    restrictions: { first_time_transaction: true },
  });
  await createAdminClient().rpc("set_referral_promo", { p_user: userId, p_promotion_code_id: promo.id });
  return true;
}

/**
 * Fidélité : arc tenu = −50 % sur la prochaine facture de l'abonnement (coupon à usage unique).
 * Sans abonnement (Fondateur, accès offert) : rien à appliquer.
 */
export async function applyLoyaltyDiscount(subscriptionId: string): Promise<boolean> {
  const stripe = getStripe();
  await ensureCoupon(LOYALTY_COUPON, 50, "Fidélité Nonante (−50 %)");
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (!["active", "trialing", "past_due"].includes(subscription.status)) return false;
  await stripe.subscriptions.update(subscriptionId, { discounts: [{ coupon: LOYALTY_COUPON }] });
  return true;
}
