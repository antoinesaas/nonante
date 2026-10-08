"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth";
import { googleUrl } from "@/lib/oauth";

/** Connexion avec Google (un toucher, pas de mot de passe). */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const url = await googleUrl(safeNext(formData.get("next")));
  redirect(url ?? "/login?erreur=google");
}
