import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { sessionCookieOptions } from "@/lib/supabase/cookies";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

/**
 * Rafraîchit la session Supabase dans le proxy. Renvoie l'identifiant de l'utilisateur (ou null)
 * et les cookies à reposer sur la réponse.
 */
export async function refreshSession(request: NextRequest): Promise<{ userId: string | null; cookies: CookieToSet[] }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const toSet: CookieToSet[] = [];
  if (!url || !key) return { userId: null, cookies: toSet };

  const supabase = createServerClient(url, key, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          toSet.push({ name, value, options });
        }
      },
    },
  });

  try {
    const { data } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    return { userId: typeof sub === "string" ? sub : null, cookies: toSet };
  } catch {
    return { userId: null, cookies: toSet };
  }
}
