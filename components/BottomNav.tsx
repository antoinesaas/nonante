"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/app", label: "Aujourd'hui", match: (p: string) => p === "/app" || p.startsWith("/app/session") },
  { href: "/classement", label: "Classement", match: (p: string) => p.startsWith("/classement") },
  { href: "/app/profil", label: "Profil", match: (p: string) => p.startsWith("/app/profil") },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-3">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 items-center justify-center text-sm ${active ? "text-paper" : "text-mute hover:text-paper"}`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
