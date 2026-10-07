import "server-only";
import { z } from "zod";
import { isDisposableEmail } from "@/lib/disposable-email";
import { siteUrl } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Connexion sans mot de passe : un email avec un lien et un code à 6 chiffres.

const Email = z.email({ error: "Adresse email invalide." }).max(254);

/** Adresse normalisée, ou message d'erreur. */
export function checkEmail(raw: unknown): { email: string } | { error: string } {
  const typed = String(raw ?? "").trim().toLowerCase();
  const parsed = Email.safeParse(typed);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Adresse invalide." };
  if (isDisposableEmail(parsed.data)) return { error: "Les adresses jetables ne sont pas acceptées." };
  return { email: parsed.data };
}

/** Envoie le lien et le code. `next` : où arriver après la connexion. Renvoie un message d'erreur ou null. */
export async function sendOtp(email: string, next: string): Promise<string | null> {
  if (!(await rateLimit("login", 5, 600))) return "Trop de demandes. Réessaie dans quelques minutes.";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (!error) return null;
  return error.status === 429 ? "Trop de demandes. Réessaie dans une minute." : "Envoi impossible pour le moment. Réessaie.";
}

/** Connexion Google activée ? (fournisseur à configurer dans Supabase, puis NEXT_PUBLIC_GOOGLE_AUTH=1). */
export function googleEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1";
}

/** Adresse de connexion Google (flux PKCE : le retour passe par /auth/callback). Null si indisponible. */
export async function googleUrl(next: string): Promise<string | null> {
  if (!googleEnabled()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`, queryParams: { prompt: "select_account" } },
  });
  return error ? null : data.url;
}

/** Vérifie le code reçu. Renvoie un message d'erreur ou null. */
export async function verifyOtp(email: string, rawToken: unknown): Promise<string | null> {
  const token = String(rawToken ?? "").replace(/\s/g, "");
  if (!Email.safeParse(email).success) return "Recommence avec ton adresse email.";
  if (!/^\d{6,10}$/.test(token)) return "Le code fait 6 chiffres.";
  if (!(await rateLimit("verify", 10, 600))) return "Trop d'essais. Réessaie dans quelques minutes.";
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  return error ? "Code incorrect ou expiré." : null;
}
