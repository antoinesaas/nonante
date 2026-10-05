"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth";
import { isDisposableEmail } from "@/lib/disposable-email";
import { siteUrl } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { step: "email" | "code"; email: string; message: string | null };

const Email = z.email({ error: "Adresse email invalide." }).max(254);

/** Étape 1 : envoie un lien magique et un code à 6 chiffres (pratique dans le navigateur de TikTok). */
export async function sendLoginCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const typed = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(formData.get("next"));
  const parsed = Email.safeParse(typed);
  if (!parsed.success) return { step: "email", email: typed, message: parsed.error.issues[0]?.message ?? "Adresse invalide." };
  if (isDisposableEmail(parsed.data)) return { step: "email", email: typed, message: "Les adresses jetables ne sont pas acceptées." };
  if (!(await rateLimit("login", 5, 600))) {
    return { step: "email", email: typed, message: "Trop de demandes. Réessaie dans quelques minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true, emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    const tooMany = error.status === 429;
    return {
      step: "email",
      email: typed,
      message: tooMany ? "Trop de demandes. Réessaie dans une minute." : "Envoi impossible pour le moment. Réessaie.",
    };
  }
  return { step: "code", email: parsed.data, message: null };
}

/** Étape 2 : vérifie le code reçu par email. */
export async function verifyLoginCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").replace(/\s/g, "");
  const next = safeNext(formData.get("next"));
  if (!Email.safeParse(email).success) return { step: "email", email, message: "Recommence avec ton adresse email." };
  if (!/^\d{6,10}$/.test(token)) return { step: "code", email, message: "Le code fait 6 chiffres." };
  if (!(await rateLimit("verify", 10, 600))) {
    return { step: "code", email, message: "Trop d'essais. Réessaie dans quelques minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, message: "Code incorrect ou expiré." };
  redirect(next);
}
