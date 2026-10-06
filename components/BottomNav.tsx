"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/app", label: "Aujourd'hui", match: (p: string) => p === "/app" || p.startsWith("/app/principes") || p.startsWith("/app/quete") },
  { href: "/classement", label: "Classement", match: (p: string) => p.startsWith("/classement") || p.startsWith("/app/escouades") },
  { href: "/app/portefeuille", label: "Portefeuille", match: (p: string) => p.startsWith("/app/portefeuille") },
  { href: "/app/profil", label: "Profil", match: (p: string) => p.startsWith("/app/profil") || p.startsWith("/app/avant-apres") },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 text-[12px] ${active ? "text-paper" : "text-mute hover:text-paper"}`}
              >
                <span className={`block h-0.5 w-5 ${active ? "bg-paper" : "bg-ink/0"}`} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
