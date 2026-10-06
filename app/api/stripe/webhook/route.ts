import type Stripe from "stripe";
import { requireEnv } from "@/lib/env";
import { fulfillCheckout, recordInvoice, syncSubscription } from "@/lib/payments";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook Stripe : signature vérifiée, chaque événement traité une seule fois
 * (table stripe_events + fonctions idempotentes). En cas d'erreur on répond 500 :
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
        await fulfillCheckout(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object);
        break;
      case "invoice.paid":
        await recordInvoice(event.data.object);
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
