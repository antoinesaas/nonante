import { NextResponse, type NextRequest } from "next/server";
import { serializeUtm, UTM_COOKIE, UTM_MAX_AGE_SECONDS, utmFromSearchParams } from "@/lib/utm";

const isDev = process.env.NODE_ENV === "development";

function contentSecurityPolicy(nonce: string): string {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : null;

  return [
    "default-src 'self'",
    // React a besoin d'eval en développement uniquement.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    // Le paiement redirige vers Stripe Checkout.
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

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
      source: "/((?!api|_next/static|_next/image|icon.svg|logo.svg|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
