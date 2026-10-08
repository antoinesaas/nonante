import "server-only";
import { z } from "zod";
import { isDisposableEmail } from "@/lib/disposable-email";
import { siteUrl } from "@/lib/env";
import type { Messages } from "@/lib/i18n/messages";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Connexion sans mot de passe : un email avec un lien et un code à 6 chiffres, ou Apple / Google.
// Les fonctions renvoient une clé de message (actions.auth), traduite par l'appelant.

export type AuthError = keyof Messages["actions"]["auth"];
export type OAuthProvider = "apple" | "google";

const Email = z.email().max(254);

/** Adresse normalisée, ou clé d'erreur. */
export function checkEmail(raw: unknown): { email: string } | { error: AuthError } {
  const typed = String(raw ?? "").trim().toLowerCase();
  const parsed = Email.safeParse(typed);
  if (!parsed.success) return { error: "badEmail" };
  if (isDisposableEmail(parsed.data)) return { error: "disposable" };
  return { email: parsed.data };
}

/** Envoie le lien et le code. `next` : où arriver après la connexion. */
export async function sendOtp(email: string, next: string): Promise<AuthError | null> {
  if (!(await rateLimit("login", 5, 600))) return "tooMany";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (!error) return null;
  console.error(`[connexion] envoi de l'email impossible : ${error.status ?? "?"} ${error.code ?? error.name}`);
  return error.status === 429 ? "tooManyMinute" : "sendFailed";
}

/** Fournisseur activé ? (à configurer dans Supabase, puis NEXT_PUBLIC_APPLE_AUTH=1 / NEXT_PUBLIC_GOOGLE_AUTH=1). */
export function oauthEnabled(provider: OAuthProvider): boolean {
  return (provider === "apple" ? process.env.NEXT_PUBLIC_APPLE_AUTH : process.env.NEXT_PUBLIC_GOOGLE_AUTH) === "1";
}

export function parseProvider(raw: unknown): OAuthProvider | null {
  return raw === "apple" || raw === "google" ? raw : null;
}

/** Adresse de connexion Apple ou Google (flux PKCE : le retour passe par /auth/callback). Null si indisponible. */
export async function oauthUrl(provider: OAuthProvider, next: string): Promise<string | null> {
  if (!oauthEnabled(provider)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {}),
    },
  });
  return error ? null : data.url;
}

/** Vérifie le code reçu. */
export async function verifyOtp(email: string, rawToken: unknown): Promise<AuthError | null> {
  const token = String(rawToken ?? "").replace(/\s/g, "");
  if (!Email.safeParse(email).success) return "restart";
  if (!/^\d{6,10}$/.test(token)) return "codeLength";
  if (!(await rateLimit("verify", 10, 600))) return "tooManyTries";
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  return error ? "badCode" : null;
}
