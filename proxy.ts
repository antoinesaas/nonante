import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy";
import { serializeUtm, UTM_COOKIE, UTM_MAX_AGE_SECONDS, utmFromSearchParams } from "@/lib/utm";

const isDev = process.env.NODE_ENV === "development";

// Pages réservées aux utilisateurs connectés (vérification complète faite ensuite dans chaque page).
const PROTECTED = ["/app", "/onboarding/suite", "/admin"];

function contentSecurityPolicy(nonce: string): string {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : null;

  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval' : comptage des répétitions (MediaPipe, WebAssembly). eval seulement en développement.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Seul style en ligne autorisé, par son empreinte : l'annonceur de navigation de Next.js (lecteurs d'écran).
    "style-src-attr 'unsafe-hashes' 'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='",
    // blob: et data: pour l'aperçu photo et le QR code de double authentification ; Supabase pour les URL signées (admin).
    `img-src 'self' blob: data:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "media-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Connexion Google : passage par Supabase Auth puis Google.
    `form-action 'self' https://checkout.stripe.com https://accounts.google.com${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const session = await refreshSession(request);
  const path = request.nextUrl.pathname;

  if (!session.userId && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path + request.nextUrl.search);
    const redirect = NextResponse.redirect(login);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  // En-têtes de la requête après rafraîchissement des cookies, plus le nonce.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const { name, value, options } of session.cookies) {
    response.cookies.set(name, value, options);
  }

  // Attribution : la dernière source UTM vue est gardée 30 jours.
  const utm = utmFromSearchParams(request.nextUrl.searchParams);
  if (utm) {
    response.cookies.set(UTM_COOKIE, serializeUtm(utm), {
      maxAge: UTM_MAX_AGE_SECONDS,
      httpOnly: true,
      secure: !isDev,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|icon.svg|logo.svg|favicon.ico|sw.js|icons/|art/|models/|mediapipe/|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
