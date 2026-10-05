import type Stripe from "stripe";
import { z } from "zod";
import { formatDayFr } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { requireEnv, siteUrl } from "@/lib/env";
import { formatEuros } from "@/lib/money";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook Stripe : signature vérifiée, chaque événement traité une seule fois
 * (table stripe_events + contraintes unique). En cas d'erreur on répond 500 :
 * Stripe renverra l'événement plus tard.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Signature manquante.", { status: 400 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, requireEnv("STRIPE_WEBHOOK_SECRET"));
  } catch {
    return new Response("Signature invalide.", { status: 400 });
  }

  const admin = createAdminClient();
  const { data: alreadyProcessed, error: readError } = await admin
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (readError) return new Response("Base indisponible.", { status: 500 });
  if (alreadyProcessed) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handlePaidCheckout(event.data.object);
        break;
      default:
        break;
    }
  } catch (e) {
    const reason = e instanceof Error ? e.message : "inconnue";
    console.error(`[stripe] ${event.type} non traité : ${reason}`);
    return new Response("Erreur de traitement.", { status: 500 });
  }

  const { error: markError } = await admin
    .from("stripe_events")
    .upsert({ id: event.id, type: event.type }, { onConflict: "id", ignoreDuplicates: true });
  if (markError) console.error(`[stripe] événement non marqué comme traité : ${markError.code}`);

  return Response.json({ received: true });
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function handlePaidCheckout(session: Stripe.Checkout.Session) {
  // Moyens de paiement différés : on attend checkout.session.async_payment_succeeded.
  if (session.payment_status !== "paid") return;
  // Phase 1 : seules les préventes existent. Le pass avec compte arrive en phase 3.
  if (session.metadata?.type !== "presale") return;

  const parsedCohortId = z.uuid().safeParse(session.metadata.cohort_id);
  if (!parsedCohortId.success) throw new Error("cohort_id invalide dans les métadonnées");
  const cohortId = parsedCohortId.data;
  const email = session.customer_details?.email?.trim().toLowerCase();
  if (!email) throw new Error("email absent de la session Checkout");

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("presales")
    .upsert(
      {
        cohort_id: cohortId,
        email,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: idOf(session.payment_intent),
        stripe_customer_id: idOf(session.customer),
        stripe_promotion_code_id: idOf(session.discounts?.find((d) => d.promotion_code)?.promotion_code),
        amount_paid_cents: session.amount_total ?? 0,
        currency: session.currency ?? "eur",
        utm_source: session.metadata.utm_source ?? null,
        utm_campaign: session.metadata.utm_campaign ?? null,
      },
      { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`enregistrement de la prévente impossible (${error.code})`);

  // Déjà enregistrée (événement rejoué) : pas de second email.
  if (!inserted?.length) return;

  const { data: cohort, error: cohortError } = await admin
    .from("cohorts")
    .select("name, start_date, end_date")
    .eq("id", cohortId)
    .single();
  if (cohortError) {
    console.error(`[stripe] cohorte introuvable pour l'email de confirmation : ${cohortError.code}`);
    return;
  }

  await sendEmail({
    to: email,
    subject: "Ta place est réservée.",
    text: [
      `Ta place est réservée : ${cohort.name}.`,
      "",
      `Départ : ${formatDayFr(cohort.start_date, { weekday: true })}.`,
      `Fin : ${formatDayFr(cohort.end_date, { weekday: true })}.`,
      `Montant payé : ${formatEuros(session.amount_total ?? 0)}.`,
      "",
      "Avant le départ, tu recevras un email pour créer ton compte avec cette adresse.",
      "Tu choisiras ton objectif, et l'app te donnera tes principes.",
      "",
      siteUrl(),
      "",
      "Nonante",
    ].join("\n"),
  });
}
