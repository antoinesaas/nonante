import Link from "next/link";
import { Logo } from "@/components/Logo";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-xl border-t border-line px-5 pt-10 pb-12 text-sm text-mute">
      <Link href="/" aria-label="Nonante, accueil">
        <Logo size="sm" />
      </Link>
      <nav aria-label="Informations légales" className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/legal/mentions" className="hover:text-paper">
          Mentions légales
        </Link>
        <Link href="/legal/cgv" className="hover:text-paper">
          CGV
        </Link>
        <Link href="/legal/confidentialite" className="hover:text-paper">
          Confidentialité
        </Link>
      </nav>
    </footer>
  );
}
