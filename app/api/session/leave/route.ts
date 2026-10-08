import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Onglet fermé ou appli quittée pendant un minuteur : la page envoie navigator.sendBeacon ici, et la session casse.
 * Même origine seulement (le cookie de session est en SameSite=Lax : une autre origine ne peut pas le déclencher).
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new NextResponse(null, { status: 403 });
  if (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin") {
    return new NextResponse(null, { status: 403 });
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new NextResponse(null, { status: 401 });
  await supabase.rpc("leave_session");
  return new NextResponse(null, { status: 204 });
}
