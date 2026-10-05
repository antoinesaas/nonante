"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { currentPrice } from "@/lib/cohorts";
import type { Database } from "@/lib/database.types";
import { todayParis } from "@/lib/dates";
import { siteUrl } from "@/lib/env";
import { passDescription } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUtm, UTM_COOKIE } from "@/lib/utm";

export type CheckoutState = { error: string | null };

type Cohort = Database["public"]["Tables"]["cohorts"]["Row"];

const UNAVAILABLE = "Le paiement n'est pas encore disponible. Réessaie plus tard.";

async function utmMetadata(): Promise<Record<string, string>> {
  const utm = parseUtm((await cookies()).get(UTM_COOKIE)?.value);
  const metadata: Record<string, string> = {};
  if (utm.source) metadata.utm_source = utm.source;
  if (utm.campaign) metadata.utm_campaign = utm.campaign;
  return metadata;
}

/**
 * Utilise le prix Stripe de la cohorte s'il existe et correspond au montant en base.
 * Sinon (prix modifié en base, script stripe-setup pas encore lancé), prix calculé à la volée.
 * Le montant est toujours lu en base, jamais envoyé par le client.
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
      product_data: { name: `Pass d'arc · ${cohort.name}`, description: passDescription(cohort) },
    },
  };
}

async function createSession(params: Stripe.Checkout.SessionCreateParams): Promise<string | null> {
  try {
    const session = await getStripe().checkout.sessions.create(params);
    return session.url;
  } catch (e) {
    console.error(`[checkout] création de la session Stripe impossible : ${e instanceof Error ? e.name : "inconnue"}`);
    return null;
  }
}

/** Pass d'arc pour l'inscription en attente de l'utilisateur connecté. */
export async function startPassCheckout(): Promise<CheckoutState> {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/checkout");

  // Une prévente au même email ? Rattachée, pas de second paiement.
  const { data: claimed } = await supabase.rpc("claim_presale");
  if (claimed) redirect("/app?paid=1");

  if (!stripeConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: UNAVAILABLE };
  if (!(await rateLimit("checkout", 10, 600))) return { error: "Trop de tentatives. Réessaie dans quelques minutes." };

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, cohort_id")
    .eq("user_id", user.id)
    .eq("status", "pending_payment")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!enrollment) redirect("/onboarding");

  const { data: cohort } = await createAdminClient().from("cohorts").select("*").eq("id", enrollment.cohort_id).single();
  if (!cohort || !cohort.enroll_open || todayParis() > addDays(cohort.start_date, 6)) {
    return { error: "Cet arc n'est plus ouvert aux inscriptions." };
  }

  const metadata = { type: "pass", enrollment_id: enrollment.id, cohort_id: cohort.id, user_id: user.id, ...(await utmMetadata()) };
  let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
  try {
    lineItem = await passLineItem(cohort);
  } catch {
    return { error: UNAVAILABLE };
  }
  const url = await createSession({
    mode: "payment",
    line_items: [lineItem],
    allow_promotion_codes: true,
    customer_email: user.email,
    client_reference_id: user.id,
    locale: "fr",
    metadata,
    payment_intent_data: { metadata: { type: "pass", enrollment_id: enrollment.id, cohort_id: cohort.id } },
    success_url: `${siteUrl()}/app?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/checkout`,
  });
  if (!url) return { error: "Le paiement n'a pas pu démarrer. Réessaie dans un instant." };
  redirect(url);
}

/** Mise sur soi (FEATURE_STAKE) : paiement séparé, remboursé si l'arc est tenu, reversé à une association sinon. */
export async function startStakeCheckout(): Promise<CheckoutState> {
  if (process.env.FEATURE_STAKE !== "true") return { error: "La mise n'est pas proposée." };
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/app");
  if (!stripeConfigured()) return { error: UNAVAILABLE };
  if (!(await rateLimit("stake", 5, 600))) return { error: "Trop de tentatives. Réessaie dans quelques minutes." };

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, cohort_id, status, stake_status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!enrollment || enrollment.stake_status !== "none") return { error: "Aucune mise possible pour cet arc." };
  const { data: cohort } = await supabase.from("cohorts").select("start_date").eq("id", enrollment.cohort_id).single();
  if (!cohort || todayParis() >= cohort.start_date) return { error: "La mise se fait avant le départ de l'arc." };

  const amount = Number(process.env.DEFAULT_STAKE_CENTS ?? "3000");
  const url = await createSession({
    mode: "payment",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: amount,
        product_data: {
          name: "Mise sur soi",
          description: "Remboursée intégralement si tu tiens l'arc. Reversée à une association sinon.",
        },
      },
    }],
    customer_email: user.email,
    client_reference_id: user.id,
    locale: "fr",
    metadata: { type: "stake", enrollment_id: enrollment.id, user_id: user.id },
    payment_intent_data: { metadata: { type: "stake", enrollment_id: enrollment.id } },
    success_url: `${siteUrl()}/app?mise=1`,
    cancel_url: `${siteUrl()}/app`,
  });
  if (!url) return { error: "Le paiement n'a pas pu démarrer. Réessaie dans un instant." };
  redirect(url);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const PresaleInput = z.object({ cohortId: z.uuid() });

/**
 * Prévente sans compte (landing) : Stripe collecte l'email ; le paiement sera rattaché
 * au compte créé avec ce même email.
 */
export async function startPresaleCheckout(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const parsed = PresaleInput.safeParse({ cohortId: formData.get("cohortId") });
  if (!parsed.success) return { error: "Requête invalide." };
  if (!stripeConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: UNAVAILABLE };
  if (!(await rateLimit("checkout", 10, 600))) return { error: "Trop de tentatives. Réessaie dans quelques minutes." };

  const { data: cohort, error } = await createAdminClient().from("cohorts").select("*").eq("id", parsed.data.cohortId).maybeSingle();
  if (error) return { error: "Service indisponible. Réessaie dans un instant." };
  if (!cohort || !cohort.enroll_open || cohort.is_test || cohort.start_date <= todayParis()) {
    return { error: "Cet arc n'est plus ouvert aux préventes." };
  }

  let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
  try {
    lineItem = await passLineItem(cohort);
  } catch {
    return { error: UNAVAILABLE };
  }
  const url = await createSession({
    mode: "payment",
    line_items: [lineItem],
    allow_promotion_codes: true,
    customer_creation: "always",
    locale: "fr",
    metadata: { type: "presale", cohort_id: cohort.id, ...(await utmMetadata()) },
    payment_intent_data: { metadata: { type: "presale", cohort_id: cohort.id } },
    success_url: `${siteUrl()}/merci?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/#rejoindre`,
  });
  if (!url) return { error: "Le paiement n'a pas pu démarrer. Réessaie dans un instant." };
  redirect(url);
}
