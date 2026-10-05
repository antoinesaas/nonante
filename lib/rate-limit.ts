import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Empreinte de l'appelant : HMAC de son IP. L'IP elle-même n'est jamais stockée.
 * Sur Vercel, x-forwarded-for est réécrit par la plateforme (pas falsifiable).
 */
async function callerKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "inconnue";
  // CRON_SECRET sert de clé HMAC : c'est un secret serveur déjà présent partout.
  const secret = process.env.CRON_SECRET ?? "nonante-dev";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

/**
 * Fenêtre fixe : au plus `max` appels par `windowSeconds` pour cette action et cet appelant.
 * En cas d'erreur de la base, on refuse (fail closed).
 */
export async function rateLimit(action: string, max: number, windowSeconds: number): Promise<boolean> {
  const bucket = `${action}:${await callerKey()}`;
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error(`[rate-limit] erreur base : ${error.code}`);
    return false;
  }
  return data === true;
}
