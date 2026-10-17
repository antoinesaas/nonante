import { Analytics } from "@vercel/analytics/next";
import { Haptics } from "@/components/Haptics";
import type { Metadata, Viewport } from "next";
import { Doto, Inter, Inter_Tight } from "next/font/google";
import { connection } from "next/server";
import { I18nProvider } from "@/components/I18nProvider";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Titres et grands chiffres : Inter Tight, serré comme les grands titres d'iOS.
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
});

// Chiffres en matrice de points (jour de l'arc, minuteur) : quelques chiffres seulement.
const doto = Doto({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-doto",
  display: "swap",
});

// Écrans d'iPhone couverts par les images de démarrage : largeur, hauteur (points), densité.
const SPLASH = [
  [440, 956, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [375, 667, 2],
] as const;

const OG_LOCALE = { fr: "fr_FR", en: "en_GB", de: "de_DE", es: "es_ES" } as const;

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await getI18n();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: `Nonante · ${m.common.tagline}`, template: "%s · Nonante" },
    description: m.common.taglineLong,
    applicationName: "Nonante",
    appleWebApp: {
      capable: true,
      title: "Nonante",
      statusBarStyle: "black-translucent",
      // Images de démarrage (scripts/gen-splash.mjs) : l'iPhone les montre pendant le lancement, plus d'écran noir.
      startupImage: SPLASH.map(([w, h, dpr]) => ({
        url: `/splash/${w * dpr}x${h * dpr}.png`,
        media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
      })),
    },
    icons: { apple: "/icons/apple-touch-icon.png" },
    openGraph: { title: m.common.tagline, description: m.common.taglineLong, siteName: "Nonante", locale: OG_LOCALE[locale], type: "website" },
  };
}

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Rendu à chaque requête : nécessaire pour la CSP à nonce (voir proxy.ts).
  await connection();
  const { locale, m } = await getI18n();

  return (
    <html lang={locale} className={`${inter.variable} ${interTight.variable} ${doto.variable}`}>
      <body className="min-h-dvh bg-ink font-sans text-paper antialiased">
        <I18nProvider locale={locale} messages={m}>
          {children}
        </I18nProvider>
        {/* Mesure d'audience Vercel : sans cookie, servie par le même domaine (script injecté, autorisé par la CSP). */}
        <Analytics />
        <Haptics />
      </body>
    </html>
  );
}
