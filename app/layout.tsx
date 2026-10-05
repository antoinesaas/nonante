import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
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

const description =
  "Un arc de 90 jours pour les étudiants-entrepreneurs. Un objectif, une date, des principes imposés. Rien ne se valide sans preuve.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Nonante · Tiens 90 jours. Prouve-le.", template: "%s · Nonante" },
  description,
  openGraph: {
    title: "Tiens 90 jours. Prouve-le.",
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
    <html lang="fr" className={`${inter.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-dvh bg-ink font-sans text-paper antialiased">{children}</body>
    </html>
  );
}
