import "server-only";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Connexion : uniquement avec Google (flux PKCE, le retour passe par /auth/callback).

/** Adresse de connexion Google, ou null si Supabase la refuse. `next` : où arriver après la connexion. */
export async function googleUrl(next: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) console.error(`[connexion] Google indisponible : ${error.code ?? error.name}`);
  return error ? null : data.url;
}
