import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";

export default function LegalLayout({ children }: LayoutProps<"/legal">) {
  return (
    <>
      <header className="mx-auto w-full max-w-xl px-5 pt-6">
        <Link href="/" aria-label="Nonante, accueil">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-xl px-5 pt-14 pb-20">
        <article className="space-y-6 leading-relaxed [&_h1]:font-serif [&_h1]:text-5xl [&_h1]:leading-none [&_h2]:pt-6 [&_h2]:font-serif [&_h2]:text-3xl [&_li]:ml-5 [&_li]:list-disc [&_p]:text-paper/90">
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
