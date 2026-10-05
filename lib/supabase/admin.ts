import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { requireEnv } from "@/lib/env";

/**
 * Client Supabase avec la clé service_role : contourne la RLS.
 * Réservé au serveur (Server Actions, webhooks, crons). Ne jamais l'exposer.
 */
export function createAdminClient() {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
