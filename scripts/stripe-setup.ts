/**
 * Crée (une seule fois) les coupons de parrainage (−20 %) et de fidélité (−50 %), le produit
 * « Pass d'arc » et, pour chaque cohorte, un prix normal et un prix early bird au montant lu en base.
 * Stocke les IDs des prix sur la cohorte.
 *
 * Relançable sans risque : un prix n'est recréé que s'il manque ou si le montant en base a changé.
 * Usage : npm run stripe:setup
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { Database } from "../lib/database.types";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

const stripe = new Stripe(env("STRIPE_SECRET_KEY"));
const supabase = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function passProduct(): Promise<Stripe.Product> {
  const found = await stripe.products.search({ query: "metadata['nonante']:'pass' AND active:'true'" });
  if (found.data[0]) return found.data[0];
  return stripe.products.create({
    name: "Pass d'arc",
    description: "Accès à un arc Nonante de 90 jours.",
    metadata: { nonante: "pass" },
  });
}

/** Renvoie l'ID d'un prix Stripe au bon montant : l'existant s'il convient, sinon un nouveau. */
async function ensurePrice(
  productId: string,
  existingId: string | null,
  cents: number,
  cohortId: string,
  kind: "normal" | "early",
): Promise<string> {
  if (existingId) {
    const existing = await stripe.prices.retrieve(existingId);
    if (existing.active && existing.unit_amount === cents && existing.currency === "eur") return existing.id;
    if (existing.active) await stripe.prices.update(existing.id, { active: false });
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: "eur",
    unit_amount: cents,
    nickname: `${kind === "early" ? "Early bird" : "Normal"} · ${cohortId}`,
    metadata: { nonante: "pass", cohort_id: cohortId, kind },
  });
  return price.id;
}

// Remises commerciales (mêmes identifiants que lib/stripe-codes.ts).
const COUPONS = [
  { id: "nonante-parrainage-20", percent_off: 20, name: "Parrainage Nonante (−20 %)" },
  { id: "nonante-fidelite-50", percent_off: 50, name: "Fidélité Nonante (−50 %)" },
];

async function ensureCoupons() {
  for (const coupon of COUPONS) {
    try {
      await stripe.coupons.retrieve(coupon.id);
      console.log(`Coupon ${coupon.id} : déjà présent`);
    } catch {
      await stripe.coupons.create({ ...coupon, duration: "once" });
      console.log(`Coupon ${coupon.id} : créé`);
    }
  }
}

async function main() {
  const mode = env("STRIPE_SECRET_KEY").startsWith("sk_live_") ? "PRODUCTION" : "test";
  console.log(`Stripe en mode ${mode}.`);

  await ensureCoupons();
  const product = await passProduct();
  console.log(`Produit : ${product.id}`);

  const { data: cohorts, error } = await supabase.from("cohorts").select("*").order("start_date");
  if (error) throw new Error(`Lecture des cohortes impossible : ${error.message}`);

  for (const cohort of cohorts) {
    const priceId = await ensurePrice(product.id, cohort.stripe_price_id, cohort.price_cents, cohort.id, "normal");
    const earlyId = await ensurePrice(
      product.id,
      cohort.stripe_early_price_id,
      cohort.early_price_cents,
      cohort.id,
      "early",
    );

    const { error: updateError } = await supabase
      .from("cohorts")
      .update({ stripe_price_id: priceId, stripe_early_price_id: earlyId })
      .eq("id", cohort.id);
    if (updateError) throw new Error(`Mise à jour de « ${cohort.name} » impossible : ${updateError.message}`);

    console.log(`${cohort.name} : ${priceId} (normal), ${earlyId} (early bird)`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
