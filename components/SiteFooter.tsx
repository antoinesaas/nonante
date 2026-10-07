import Link from "next/link";
import { Logo } from "@/components/Logo";
import { EDITOR } from "@/lib/legal";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-xl border-t border-line px-5 pt-10 pb-12 text-sm text-mute">
      <Link href="/" aria-label="Nonante, accueil">
        <Logo size="sm" />
      </Link>
      <nav aria-label="Liens" className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/classement" className="hover:text-paper">
          Classement
        </Link>
        <Link href="/abonnement" className="hover:text-paper">
          Plans
        </Link>
        <Link href="/faq" className="hover:text-paper">
          Questions
        </Link>
        <Link href="/art" className="hover:text-paper">
          Crédits des images
        </Link>
        <Link href="/legal/mentions" className="hover:text-paper">
          Mentions légales
        </Link>
        <Link href="/legal/cgu" className="hover:text-paper">
          CGU
        </Link>
        <Link href="/legal/cgv" className="hover:text-paper">
          CGV
        </Link>
        <Link href="/legal/confidentialite" className="hover:text-paper">
          Confidentialité
        </Link>
      </nav>
      <p className="mt-8 text-xs">
        Une question ?{" "}
        <a href={`mailto:${EDITOR.email}`} className="underline underline-offset-4 hover:text-paper">
          {EDITOR.email}
        </a>
      </p>
    </footer>
  );
}
