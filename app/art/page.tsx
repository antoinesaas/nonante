import type { Metadata } from "next";
import Link from "next/link";
import { ArtFigure } from "@/components/Art";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { allArt } from "@/lib/art";

export const metadata: Metadata = {
  title: "Œuvres",
  description: "Les œuvres du domaine public utilisées par Nonante, avec leurs crédits et leurs sources.",
};

export default function ArtPage() {
  const works = allArt();
  return (
    <>
      <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-16">
        <Link href="/" aria-label="Nonante, accueil">
          <Logo size="sm" />
        </Link>
        <h1 className="mt-14 font-serif text-5xl leading-none">Œuvres.</h1>
        <p className="mt-5 leading-relaxed text-mute">
          Toutes appartiennent au domaine public : leurs auteurs sont morts depuis plus de 70 ans, ou ce sont des photographies
          d&apos;une administration américaine. Chaque fichier a été vérifié sur Wikimedia Commons.
        </p>
        <ul className="mt-12 space-y-14">
          {works.map((w) => (
            <li key={w.slug}>
              <ArtFigure slug={w.slug} variant="couleur" />
              <p className="mt-2 text-xs text-mute">
                Licence : {w.license}.{" "}
                <a href={w.source} rel="noopener noreferrer" target="_blank" className="underline underline-offset-4">
                  Source
                </a>
              </p>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
