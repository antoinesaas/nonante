import type { NextConfig } from "next";

// La Content-Security-Policy (avec nonce) est posée par proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const noCamera = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";
// Caméra autorisée uniquement sur les pages de preuve.
const camera = "camera=(self), microphone=(), geolocation=(), payment=(), usb=()";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Photos de preuve envoyées au serveur (refusées au-delà de 3 Mo).
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: [...securityHeaders, { key: "Permissions-Policy", value: noCamera }] },
      {
        source: "/app/:kind(reps|photo|controle|epreuve)/:path*",
        headers: [{ key: "Permissions-Policy", value: camera }],
      },
      { source: "/app/epreuve", headers: [{ key: "Permissions-Policy", value: camera }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
