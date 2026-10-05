import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Cookies de session : HttpOnly, Secure, SameSite=Lax (§14).
 * Toute l'authentification passe par le serveur, le navigateur n'a jamais besoin de les lire.
 */
export const sessionCookieOptions: CookieOptionsWithName = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
