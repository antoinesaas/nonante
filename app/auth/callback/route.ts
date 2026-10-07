import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/auth";
import { adoptPendingCookie, PENDING_COOKIE } from "@/lib/pending";
import { createClient } from "@/lib/supabase/server";

/** Lien magique ou retour de Google (flux PKCE) : échange le code contre une session. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Questionnaire rempli avant une connexion Google : les réponses passent du cookie à la base.
      const store = await cookies();
      const pending = store.get(PENDING_COOKIE)?.value;
      if (pending && data.user?.email) await adoptPendingCookie(data.user.email, pending);
      const response = NextResponse.redirect(new URL(next, url.origin));
      if (pending) response.cookies.delete(PENDING_COOKIE);
      return response;
    }
  }
  return NextResponse.redirect(new URL("/login?erreur=lien", url.origin));
}
