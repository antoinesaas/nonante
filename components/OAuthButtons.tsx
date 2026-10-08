"use client";

import { useI18n } from "@/components/I18nProvider";

export type OAuthProvider = "apple" | "google";

/** Fournisseurs activés (Apple d'abord, comme le demandent ses règles d'affichage). */
export const OAUTH_PROVIDERS: OAuthProvider[] = [
  ...(process.env.NEXT_PUBLIC_APPLE_AUTH === "1" ? (["apple"] as const) : []),
  ...(process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1" ? (["google"] as const) : []),
];

/** Logo Google officiel (règles de marque de Google). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Logo Apple (bouton « Continuer avec Apple », selon les règles d'Apple : fond blanc sur fond sombre). */
function AppleMark() {
  return (
    <svg viewBox="0 0 17 20" className="h-5 w-[17px]" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.06 10.63c-.02-2.3 1.88-3.41 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.14-2.77.83-3.49.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.59-.75 2.99-.75 1.4 0 1.79.75 3.01.72 1.24-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.53 1.26-2.6-.03-.01-2.42-.93-2.45-3.71ZM11.77 3.88c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.78-.97 2.83 1.02.08 2.07-.52 2.71-1.29Z"
      />
    </svg>
  );
}

const base =
  "inline-flex h-14 w-full items-center justify-center gap-3 rounded-xs px-6 text-base font-medium transition-[border-color,opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-50";

export function oauthButtonClass(provider: OAuthProvider): string {
  return provider === "apple" ? `${base} bg-paper text-ink hover:opacity-90` : `${base} border border-line bg-surface text-paper hover:border-paper`;
}

export function ProviderLabel({ provider }: { provider: OAuthProvider }) {
  const { m } = useI18n();
  return (
    <>
      {provider === "apple" ? <AppleMark /> : <GoogleMark />}
      {m.common.oauth[provider]}
    </>
  );
}

/** Séparateur « ou » entre les fournisseurs et l'email. */
export function OrDivider() {
  const { m } = useI18n();
  return (
    <p className="flex items-center gap-4 text-xs text-mute" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      {m.common.oauth.or}
      <span className="h-px flex-1 bg-line" />
    </p>
  );
}
