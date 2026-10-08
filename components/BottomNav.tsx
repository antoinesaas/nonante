"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import { Logo } from "@/components/Logo";

type Key = "today" | "leaderboard" | "wallet" | "grades" | "profile";

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
};

const MATCH: Record<Key, (p: string) => boolean> = {
  today: (p) => p === "/app" || p.startsWith("/app/principes") || p.startsWith("/app/quete") || p.startsWith("/app/avant-apres"),
  leaderboard: (p) => p.startsWith("/classement") || p.startsWith("/app/escouades"),
  wallet: (p) => p.startsWith("/app/portefeuille"),
  grades: (p) => p.startsWith("/app/notes"),
  profile: (p) => p.startsWith("/app/profil"),
};

const HREF: Record<Key, string> = {
  today: "/app",
  leaderboard: "/classement",
  wallet: "/app/portefeuille",
  grades: "/app/notes",
  profile: "/app/profil",
};

/**
 * Navigation de l'app, façon iPhone : une capsule de verre qui flotte en bas de l'écran, icône et libellé.
 * Sur ordinateur : barre en haut. Les onglets Portefeuille et Notes suivent le profil de l'arc.
 */
export function BottomNav({ wallet, grades }: { wallet: boolean; grades: boolean }) {
  const { m } = useI18n();
  const pathname = usePathname();
  const keys: Key[] = ["today", "leaderboard", ...(wallet ? (["wallet"] as const) : []), ...(grades ? (["grades"] as const) : []), "profile"];
  const label = (k: Key) => (k === "grades" ? m.app.grades.nav : m.common.nav[k]);

  return (
    <>
      {/* Téléphone */}
      <nav aria-label={m.common.nav.aria} className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <ul className="glass pointer-events-auto mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-full p-1.5">
          {keys.map((k) => {
            const active = MATCH[k](pathname);
            return (
              <li key={k} className="flex-1">
                <Link
                  href={HREF[k]}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium tracking-wide transition-[background-color,color,transform] duration-200 active:scale-90 ${
                    active ? "bg-paper/12 text-paper" : "text-mute hover:text-paper"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {ICONS[k]}
                  </svg>
                  <span className="max-w-full truncate px-1">{label(k)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Ordinateur */}
      <nav aria-label={m.common.nav.aria} className="glass fixed inset-x-0 top-0 z-30 hidden border-b border-line lg:block">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-10 px-8">
          <Link href="/app" aria-label={m.common.homeAria}>
            <Logo size="sm" />
          </Link>
          <ul className="flex items-center gap-1">
            {keys.map((k) => {
              const active = MATCH[k](pathname);
              return (
                <li key={k}>
                  <Link
                    href={HREF[k]}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm transition-colors ${active ? "bg-paper/12 text-paper" : "text-mute hover:text-paper"}`}
                  >
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {ICONS[k]}
                    </svg>
                    {label(k)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}
