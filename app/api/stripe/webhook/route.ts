import type Stripe from "stripe";
import { z } from "zod";
import { sendPresaleConfirmation } from "@/lib/emails";
import { requireEnv } from "@/lib/env";
import { fulfillPass, idOf } from "@/lib/payments";
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

async function handlePaidCheckout(session: Stripe.Checkout.Session) {
  // Moyens de paiement différés : on attend checkout.session.async_payment_succeeded.
  if (session.payment_status !== "paid") return;
  switch (session.metadata?.type) {
    case "pass":
      await fulfillPass(session);
      return;
    case "stake":
      await recordStake(session);
      return;
    case "presale":
      await recordPresale(session);
      return;
    default:
      return;
  }
}

async function recordStake(session: Stripe.Checkout.Session) {
  const enrollmentId = z.uuid().safeParse(session.metadata?.enrollment_id);
  if (!enrollmentId.success) throw new Error("enrollment_id invalide dans les métadonnées");
  const { error } = await createAdminClient().rpc("record_stake", {
    p_enrollment: enrollmentId.data,
    p_payment_intent: idOf(session.payment_intent),
    p_amount: session.amount_total ?? 0,
  });
  if (error) throw new Error(`mise non enregistrée (${error.code})`);
}

async function recordPresale(session: Stripe.Checkout.Session) {
  const parsedCohortId = z.uuid().safeParse(session.metadata?.cohort_id);
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
        utm_source: session.metadata?.utm_source ?? null,
        utm_campaign: session.metadata?.utm_campaign ?? null,
      },
      { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`enregistrement de la prévente impossible (${error.code})`);

  // Déjà enregistrée (événement rejoué) : pas de second email.
  if (!inserted?.length) return;

  const { data: cohort } = await admin.from("cohorts").select("name, start_date, end_date").eq("id", cohortId).single();
  if (cohort) await sendPresaleConfirmation(email, cohort, session.amount_total ?? 0);
}
