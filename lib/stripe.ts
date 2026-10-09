import "server-only";
import Stripe from "stripe";
import { requireEnv } from "@/lib/env";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Clé live (sk_live_… ou clé restreinte rk_live_…) : les prix et le portail « live » rangés en base sont utilisés (live_price_id, stripe_portal_live),
 * sinon ceux du mode test. Passer en production = changer la clé sur Vercel, rien d'autre.
 */
export function stripeLive(): boolean {
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
}

export function getStripe(): Stripe {
  client ??= new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return client;
}
