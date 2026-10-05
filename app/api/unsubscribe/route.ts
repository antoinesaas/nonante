import { z } from "zod";
import { verifyUnsubscribe } from "@/lib/emails";
import { createAdminClient } from "@/lib/supabase/admin";

const page = (text: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nonante</title><body style="background:#0a0a0a;color:#f2f2f2;font:16px/1.5 system-ui;padding:48px 20px;max-width:32rem;margin:auto"><p>${text}</p><p><a href="/" style="color:#8a8a8a">Retour à Nonante</a></p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } },
  );

/** Lien de désinscription des rappels : jeton HMAC, aucune connexion requise. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = z.uuid().safeParse(url.searchParams.get("u"));
  const token = url.searchParams.get("t") ?? "";
  if (!user.success || !verifyUnsubscribe(user.data, token)) return page("Lien invalide.", 400);
  const { error } = await createAdminClient().from("profiles").update({ email_reminders: false }).eq("id", user.data);
  if (error) return page("Désinscription impossible pour le moment. Réessaie plus tard.", 500);
  return page("C'est fait : tu ne recevras plus de rappels par email.");
}
