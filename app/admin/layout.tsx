import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const LINKS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/controles", label: "Contrôles" },
  { href: "/admin/signalements", label: "Signalements" },
  { href: "/admin/escouades", label: "Escouades" },
  { href: "/admin/journal", label: "Journal" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-6 pb-16">
      <div className="flex items-center justify-between">
        <Link href="/app" aria-label="Retour à l'app">
          <Logo size="sm" />
        </Link>
        <span className="text-xs tracking-[0.2em] text-mute uppercase">Admin</span>
      </div>
      <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-line pb-4 text-sm">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-mute hover:text-paper">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="mt-8">{children}</div>
    </div>
  );
}
