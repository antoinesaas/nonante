import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { requireEnv } from "@/lib/env";

/**
 * Client Supabase côté serveur, avec la clé publique (anon) et la session de
 * l'utilisateur lue dans les cookies. Soumis à la RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Appelé depuis un Server Component : les cookies sont en lecture seule.
            // Le rafraîchissement de session se fera dans le proxy (phase 2).
          }
        },
      },
    },
  );
}
