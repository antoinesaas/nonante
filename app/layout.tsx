import type { Metadata, Viewport } from "next";
import { Caveat, Instrument_Serif, Inter } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

// Écriture manuscrite : quelques mots seulement (annotations du questionnaire, accents de la landing).
const caveat = Caveat({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

const description =
  "Le jeu de la vraie vie pour les jeunes entrepreneurs : 90 jours, tes principes, chaque jour prouvé. Maxe tes stats.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Nonante · Le jeu de la vraie vie", template: "%s · Nonante" },
  description,
  applicationName: "Nonante",
  appleWebApp: { capable: true, title: "Nonante", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    title: "Le jeu de la vraie vie. 90 jours pour maxer tes stats.",
    description,
    siteName: "Nonante",
    locale: "fr_FR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Rendu à chaque requête : nécessaire pour la CSP à nonce (voir proxy.ts).
  await connection();

  return (
    <html lang="fr" className={`${inter.variable} ${instrumentSerif.variable} ${caveat.variable}`}>
      <body className="min-h-dvh bg-ink font-sans text-paper antialiased">{children}</body>
    </html>
  );
}
