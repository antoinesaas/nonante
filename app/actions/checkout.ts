"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { z } from "zod";
import { currentPrice } from "@/lib/cohorts";
import type { Database } from "@/lib/database.types";
import { formatDayFr, todayParis } from "@/lib/dates";
import { siteUrl } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUtm, UTM_COOKIE } from "@/lib/utm";

export type CheckoutState = { error: string | null };

type Cohort = Database["public"]["Tables"]["cohorts"]["Row"];

const Input = z.object({ cohortId: z.uuid() });

/**
 * Prévente (phase 1) : paiement d'un pass pour un arc pas encore démarré, sans compte.
 * Stripe collecte l'email ; le paiement sera rattaché au compte créé avec ce même email.
 * Le montant est toujours lu en base, jamais envoyé par le client.
 */
export async function startPresaleCheckout(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const parsed = Input.safeParse({ cohortId: formData.get("cohortId") });
  if (!parsed.success) return { error: "Requête invalide." };

  if (!stripeConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Le paiement n'est pas encore disponible. Réessaie plus tard." };
  }

  if (!(await rateLimit("checkout", 10, 600))) {
    return { error: "Trop de tentatives. Réessaie dans quelques minutes." };
  }

  const { data: cohort, error } = await createAdminClient()
    .from("cohorts")
    .select("*")
    .eq("id", parsed.data.cohortId)
    .maybeSingle();
  if (error) return { error: "Service indisponible. Réessaie dans un instant." };
  if (!cohort || !cohort.enroll_open || cohort.start_date <= todayParis()) {
    return { error: "Cet arc n'est plus ouvert aux préventes." };
  }

  const utm = parseUtm((await cookies()).get(UTM_COOKIE)?.value);
  const metadata: Record<string, string> = { type: "presale", cohort_id: cohort.id };
  if (utm.source) metadata.utm_source = utm.source;
  if (utm.campaign) metadata.utm_campaign = utm.campaign;

  let checkoutUrl: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [await passLineItem(cohort)],
      allow_promotion_codes: true,
      customer_creation: "always",
      locale: "fr",
      metadata,
      payment_intent_data: { metadata: { type: "presale", cohort_id: cohort.id } },
      success_url: `${siteUrl()}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/#rejoindre`,
    });
    checkoutUrl = session.url;
  } catch (e) {
    const kind = e instanceof Error ? e.name : "inconnue";
    console.error(`[checkout] création de la session Stripe impossible : ${kind}`);
  }

  if (!checkoutUrl) {
    return { error: "Le paiement n'a pas pu démarrer. Réessaie dans un instant." };
  }
  redirect(checkoutUrl);
}

/**
 * Utilise le prix Stripe de la cohorte s'il existe et correspond au montant en base.
 * Sinon (prix modifié en base, script stripe-setup pas encore lancé), prix calculé à la volée.
 */
async function passLineItem(cohort: Cohort): Promise<Stripe.Checkout.SessionCreateParams.LineItem> {
  const price = currentPrice(cohort);
  const priceId = price.early ? cohort.stripe_early_price_id : cohort.stripe_price_id;

  if (priceId) {
    const stripePrice = await getStripe().prices.retrieve(priceId);
    if (stripePrice.active && stripePrice.currency === "eur" && stripePrice.unit_amount === price.cents) {
      return { price: priceId, quantity: 1 };
    }
    console.warn("[checkout] prix Stripe différent du prix en base : prix calculé utilisé.");
  }

  return {
    quantity: 1,
    price_data: {
      currency: "eur",
      unit_amount: price.cents,
      product_data: {
        name: `Pass d'arc · ${cohort.name}`,
        description: `Du ${formatDayFr(cohort.start_date)} au ${formatDayFr(cohort.end_date)}.`,
      },
    },
  };
}
