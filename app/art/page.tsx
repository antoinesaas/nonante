import type { Metadata } from "next";
import Link from "next/link";
import { ArtFigure } from "@/components/Art";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { allArt } from "@/lib/art";

export const metadata: Metadata = {
  title: "Crédits photos",
  description: "Les photos CC0 et les œuvres du domaine public utilisées par Nonante, avec leurs auteurs et leurs sources.",
};

export default function ArtPage() {
  const all = allArt();
  const photos = all.filter((a) => a.kind === "photo");
  const works = all.filter((a) => a.kind !== "photo");
  return (
    <>
      <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-16">
        <Link href="/" aria-label="Nonante, accueil">
          <Logo size="sm" />
        </Link>
        <h1 className="mt-14 font-serif text-5xl leading-none">Crédits photos.</h1>
        <p className="mt-5 leading-relaxed text-mute">
          Nonante n&apos;utilise que des images libres : des photographies publiées sous licence CC0 ou marquées « domaine
          public », trouvées via Openverse, et des œuvres dont les auteurs sont morts depuis plus de 70 ans, vérifiées sur
          Wikimedia Commons. Elles sont passées en noir et blanc par Nonante.
        </p>

        <h2 className="mt-14 font-serif text-3xl">Photographies</h2>
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8">
          {photos.map((w) => (
            <li key={w.slug}>
              <ArtFigure slug={w.slug} imgClassName="aspect-[4/5] h-auto w-full object-cover" />
              <p className="mt-1 text-[11px] text-mute">
                « {w.title} ».{" "}
                <a href={w.source} rel="noopener noreferrer" target="_blank" className="underline underline-offset-4">
                  Source
                </a>
              </p>
            </li>
          ))}
        </ul>

        <h2 className="mt-14 font-serif text-3xl">Œuvres</h2>
        <ul className="mt-6 space-y-14">
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
