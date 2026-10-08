"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { checkEmail, oauthUrl, parseProvider, sendOtp, verifyOtp } from "@/lib/otp";

export type LoginState = { step: "email" | "code"; email: string; message: string | null };

/** Étape 1 : envoie un lien magique et un code à 6 chiffres (pratique dans le navigateur de TikTok). */
export async function sendLoginCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { m } = await getI18n();
  const typed = String(formData.get("email") ?? "").trim().toLowerCase();
  const checked = checkEmail(typed);
  if ("error" in checked) return { step: "email", email: typed, message: m.actions.auth[checked.error] };
  const error = await sendOtp(checked.email, safeNext(formData.get("next")));
  if (error) return { step: "email", email: typed, message: m.actions.auth[error] };
  return { step: "code", email: checked.email, message: null };
}

/** Étape 2 : vérifie le code reçu par email. */
export async function verifyLoginCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { m } = await getI18n();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const error = await verifyOtp(email, formData.get("token"));
  if (error) return { step: error === "restart" ? "email" : "code", email, message: m.actions.auth[error] };
  redirect(safeNext(formData.get("next")));
}

/** Connexion avec Apple ou Google (un toucher, pas d'email à ouvrir). */
export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = parseProvider(formData.get("provider"));
  const url = provider ? await oauthUrl(provider, safeNext(formData.get("next"))) : null;
  redirect(url ?? "/login?erreur=oauth");
}
