import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { allArt, artSrc, type Artwork } from "@/lib/art";
import { fmt } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.pages.credits.title, description: m.pages.credits.description };
}

function Figure({ art, variant, caption, square = false }: { art: Artwork; variant: "couleur" | "nb"; caption: React.ReactNode; square?: boolean }) {
  return (
    <figure>
      <Image
        src={artSrc(art, variant)}
        alt={art.kind === "photo" ? "" : `${art.title}, ${art.artist}`}
        width={art.width}
        height={art.height}
        sizes="(max-width: 640px) 100vw, 576px"
        className={square ? "aspect-[4/5] h-auto w-full object-cover" : "h-auto w-full"}
      />
      <figcaption className="mt-2 text-[11px] leading-snug text-mute">{caption}</figcaption>
    </figure>
  );
}

export default async function ArtPage() {
  const { m } = await getI18n();
  const t = m.pages.credits;
  const all = allArt();
  const photos = all.filter((a) => a.kind === "photo");
  const provided = all.filter((a) => a.kind === "fournie");
  const works = all.filter((a) => !a.kind);
  const source = (href: string) =>
    href ? (
      <>
        {" "}
        <a href={href} rel="noopener noreferrer" target="_blank" className="underline underline-offset-4">
          {t.source}
        </a>
      </>
    ) : null;

  return (
    <>
      <main className="mx-auto w-full max-w-xl px-5 pt-6 pb-16 lg:max-w-4xl">
        <Link href="/" aria-label={m.common.homeAria}>
          <Logo size="sm" />
        </Link>
        <h1 className="mt-14 font-serif text-5xl leading-none">{t.heading}</h1>
        <p className="mt-5 leading-relaxed text-mute lg:max-w-2xl">{t.intro}</p>

        <h2 className="mt-14 font-serif text-3xl">{t.photos}</h2>
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
          {photos.map((w) => (
            <li key={w.slug}>
              <Figure art={w} variant="nb" square caption={<>{fmt(t.photoBy, { artist: w.artist, license: w.license })}{source(w.source)}</>} />
            </li>
          ))}
        </ul>

        {provided.length ? (
          <>
            <h2 className="mt-14 font-serif text-3xl">{t.provided}</h2>
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
              {provided.map((w) => (
                <li key={w.slug}>
                  <Figure art={w} variant="nb" square caption={w.title} />
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <h2 className="mt-14 font-serif text-3xl">{t.works}</h2>
        <ul className="mt-6 space-y-14 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-14 lg:space-y-0">
          {works.map((w) => (
            <li key={w.slug}>
              <Figure
                art={w}
                variant="couleur"
                caption={
                  <>
                    {fmt(t.publicDomain, { artist: w.artist, title: w.title, year: w.year })} {fmt(t.license, { license: w.license })}
                    {source(w.source)}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
