import "server-only";
import Stripe from "stripe";
import { requireEnv } from "@/lib/env";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  client ??= new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return client;
}
