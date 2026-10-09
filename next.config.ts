import type { NextConfig } from "next";

// La Content-Security-Policy (avec nonce) est posée par proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// Caméra autorisée pour le site lui-même (jamais pour un contenu tiers). L'en-tête vaut pour tout le document :
// limité aux pages de preuve, il bloquait la caméra quand on y arrivait par la navigation de l'app (sans rechargement).
const permissions = "camera=(self), microphone=(), geolocation=(), payment=(), usb=()";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Photos de preuve envoyées au serveur (refusées au-delà de 3 Mo).
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: [...securityHeaders, { key: "Permissions-Policy", value: permissions }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
