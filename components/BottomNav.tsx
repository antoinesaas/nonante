"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { LiquidTabBar } from "@/components/LiquidTabBar";
import { Logo } from "@/components/Logo";
import { EDITOR } from "@/lib/legal";

type Key = "today" | "leaderboard" | "wallet" | "grades" | "profile" | "help";

const ICONS: Record<Key, React.ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M8.5 12.3 L11 14.8 L15.8 9.6" />
    </>
  ),
  leaderboard: (
    <>
      <path d="M4 20 V13.5 H9 V20" />
      <path d="M9 20 V8.5 H15 V20" />
      <path d="M15 20 V11.5 H20 V20" />
      <path d="M3 20.25 H21" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5 C4 6.4 4.9 5.5 6 5.5 H17.5 V8.5" />
      <rect x="4" y="8.5" width="16" height="10.5" rx="2" />
      <path d="M16 13.75 H17" />
    </>
  ),
  grades: (
    <>
      <path d="M5.5 4.5 H17 C17.8 4.5 18.5 5.2 18.5 6 V19.5 H7 C6.2 19.5 5.5 18.8 5.5 18 Z" />
      <path d="M5.5 16.5 C5.5 15.7 6.2 15 7 15 H18.5" />
      <path d="M9 8.5 H15 M9 11.5 H13" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8.75" r="3.75" />
      <path d="M4.75 19.5 C5.6 16.2 8.5 14.25 12 14.25 C15.5 14.25 18.4 16.2 19.25 19.5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M9.6 9.6 C9.6 8.3 10.7 7.5 12 7.5 C13.3 7.5 14.4 8.4 14.4 9.6 C14.4 11.3 12 11.4 12 13.3" />
      <path d="M12 16.4 V16.5" />
    </>
  ),
};

const MATCH: Record<Key, (p: string) => boolean> = {
  today: (p) => p === "/app" || p.startsWith("/app/principes") || p.startsWith("/app/quete") || p.startsWith("/app/avant-apres"),
  leaderboard: (p) => p.startsWith("/classement") || p.startsWith("/app/escouades"),
  wallet: (p) => p.startsWith("/app/portefeuille"),
  grades: (p) => p.startsWith("/app/notes"),
  profile: (p) => p.startsWith("/app/profil"),
  help: () => false,
};

const HREF: Record<Key, string> = {
  today: "/app",
  leaderboard: "/classement",
  wallet: "/app/portefeuille",
  grades: "/app/notes",
  profile: "/app/profil",
  help: `mailto:${EDITOR.email}`,
};

/**
 * Navigation de l'app, façon iPhone : une capsule de verre qui flotte en bas de l'écran, avec une bulle de verre
 * liquide qu'on peut faire glisser d'un onglet à l'autre (LiquidTabBar).
 * Sur ordinateur : barre en haut. Les onglets Portefeuille et Notes suivent le profil de l'arc.
 * Aide ouvre un email à l'adresse de contact (pas de page : une question, une réponse humaine).
 */
export function BottomNav({ wallet, grades }: { wallet: boolean; grades: boolean }) {
  const { m } = useI18n();
  const pathname = usePathname();
  const keys: Key[] = ["today", "leaderboard", ...(wallet ? (["wallet"] as const) : []), ...(grades ? (["grades"] as const) : []), "profile", "help"];
  const label = (k: Key) => (k === "grades" ? m.app.grades.nav : m.common.nav[k]);
  const href = (k: Key) => (k === "help" ? `${HREF.help}?subject=${encodeURIComponent(m.common.nav.helpSubject)}` : HREF[k]);
  // Six onglets (profil mixte) : libellés un peu plus petits pour tenir sur un iPhone de 375 px.
  const crowded = keys.length > 5;

  return (
    <>
      {/* Téléphone */}
      <nav aria-label={m.common.nav.aria} className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <LiquidTabBar
          crowded={crowded}
          tabs={keys.map((k) => ({ key: k, href: href(k), label: label(k), icon: ICONS[k], active: MATCH[k](pathname) }))}
        />
      </nav>

      {/* Ordinateur */}
      <nav aria-label={m.common.nav.aria} className="glass fixed inset-x-0 top-0 z-30 hidden border-b border-line lg:block">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-10 px-8">
          <Link href="/app" aria-label={m.common.homeAria}>
            <Logo size="sm" />
          </Link>
          <ul className="flex flex-1 items-center gap-1">
            {keys.map((k) => {
              const active = MATCH[k](pathname);
              return (
                <li key={k} className={k === "help" ? "ml-auto" : undefined}>
                  <NavLink
                    href={href(k)}
                    active={active}
                    className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm transition-colors ${active ? "bg-paper/12 text-paper" : "text-mute hover:text-paper"}`}
                  >
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {ICONS[k]}
                    </svg>
                    {label(k)}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}

/** Lien interne (navigation de l'app) ou adresse mailto: (Aide, ouvre l'app d'email). */
function NavLink({ href, active, className, children }: { href: string; active: boolean; className: string; children: React.ReactNode }) {
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={className}>
      {children}
    </Link>
  );
}
