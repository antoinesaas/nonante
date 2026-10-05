import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["email", "magiclink", "signup"];

/**
 * Lien de l'email avec token_hash : fonctionne même s'il s'ouvre dans un autre navigateur
 * (navigateur intégré de TikTok). Voir le gabarit d'email dans le README.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));
  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?erreur=lien", url.origin));
}
