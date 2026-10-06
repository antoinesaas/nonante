/**
 * Crée (une seule fois) chez Stripe : les coupons de parrainage (−20 %) et de fidélité (−50 %), les produits
 * Essentiel, Pro et Fondateur, leurs prix (mensuel, annuel, paiement unique) aux montants lus en base
 * (réglage « plans »), et la configuration du portail client. Range les identifiants en base.
 *
 * Relançable sans risque : un prix n'est recréé que s'il manque ou si son montant a changé.
 * Usage : npm run stripe:setup (clés de test pour le mode test, clés live pour la production)
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { Database, Json } from "../lib/database.types";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

const stripe = new Stripe(env("STRIPE_SECRET_KEY"));
const supabase = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Entry = { amount: number; price_id: string | null };
type Plans = { essentiel: { month: Entry; year: Entry }; pro: { month: Entry; year: Entry }; fondateur: { lifetime: Entry; limit: number } };

const PRODUCTS = {
  essentiel: { name: "Nonante Essentiel", description: "Ton arc de 90 jours, 6 principes, toutes les preuves, classement et escouades." },
  pro: { name: "Nonante Pro", description: "12 principes, portefeuille, création d'escouades, 3 jokers par arc." },
  fondateur: { name: "Nonante Fondateur", description: "Le plan Pro à vie, en un seul paiement. 100 places." },
} as const;

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

async function ensureProduct(plan: keyof typeof PRODUCTS): Promise<string> {
  const found = await stripe.products.search({ query: `metadata['nonante_plan']:'${plan}' AND active:'true'` });
  if (found.data[0]) return found.data[0].id;
  const product = await stripe.products.create({ ...PRODUCTS[plan], metadata: { nonante_plan: plan } });
  return product.id;
}

async function ensurePrice(product: string, entry: Entry, interval: "month" | "year" | null, plan: string): Promise<string> {
  if (entry.price_id) {
    const existing = await stripe.prices.retrieve(entry.price_id).catch(() => null);
    if (existing?.active && existing.unit_amount === entry.amount && existing.currency === "eur"
      && (existing.recurring?.interval ?? null) === interval) {
      return existing.id;
    }
    if (existing?.active) await stripe.prices.update(existing.id, { active: false });
  }
  const price = await stripe.prices.create({
    product,
    currency: "eur",
    unit_amount: entry.amount,
    ...(interval ? { recurring: { interval } } : {}),
    nickname: `${plan} · ${interval ?? "à vie"}`,
    metadata: { nonante_plan: plan, interval: interval ?? "lifetime" },
  });
  return price.id;
}

async function main() {
  console.log(`Stripe en mode ${env("STRIPE_SECRET_KEY").startsWith("sk_live_") ? "PRODUCTION" : "test"}.`);
  await ensureCoupons();

  const { data, error } = await supabase.from("settings").select("value").eq("key", "plans").single();
  if (error) throw new Error(`Réglage « plans » illisible : ${error.message}`);
  const plans = data.value as unknown as Plans;

  const essentiel = await ensureProduct("essentiel");
  const pro = await ensureProduct("pro");
  const fondateur = await ensureProduct("fondateur");
  plans.essentiel.month.price_id = await ensurePrice(essentiel, plans.essentiel.month, "month", "essentiel");
  plans.essentiel.year.price_id = await ensurePrice(essentiel, plans.essentiel.year, "year", "essentiel");
  plans.pro.month.price_id = await ensurePrice(pro, plans.pro.month, "month", "pro");
  plans.pro.year.price_id = await ensurePrice(pro, plans.pro.year, "year", "pro");
  plans.fondateur.lifetime.price_id = await ensurePrice(fondateur, plans.fondateur.lifetime, null, "fondateur");

  const { error: saveError } = await supabase.from("settings").update({ value: plans as unknown as Json }).eq("key", "plans");
  if (saveError) throw new Error(`Enregistrement des prix impossible : ${saveError.message}`);
  console.log("Prix enregistrés :", JSON.stringify(plans));

  // Portail client : changer de plan ou de période, mettre à jour la carte, résilier, télécharger ses factures.
  const portal = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Nonante : gère ton abonnement." },
    features: {
      customer_update: { enabled: false },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "create_prorations",
        products: [
          { product: essentiel, prices: [plans.essentiel.month.price_id!, plans.essentiel.year.price_id!] },
          { product: pro, prices: [plans.pro.month.price_id!, plans.pro.year.price_id!] },
        ],
      },
    },
  });
  await supabase.from("settings").upsert({ key: "stripe_portal", value: portal.id as unknown as Json });
  console.log(`Portail client : ${portal.id}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
