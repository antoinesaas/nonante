import Image from "next/image";
import { artSrc, getArt, type Artwork } from "@/lib/art";

export function ArtCredit({ art, className = "" }: { art: Artwork; className?: string }) {
  return (
    <p className={`text-[11px] leading-snug text-mute ${className}`}>
      {art.artist}, <span className="italic">{art.title}</span>, {art.year}. Domaine public.
    </p>
  );
}

/** Œuvre en pleine largeur avec son crédit. Rien si l'œuvre n'a pas été téléchargée. */
export function ArtFigure({
  slug,
  variant = "nb",
  priority = false,
  className = "",
}: {
  slug: string | null | undefined;
  variant?: "couleur" | "nb";
  priority?: boolean;
  className?: string;
}) {
  const art = getArt(slug);
  if (!art) return null;
  return (
    <figure className={className}>
      <Image
        src={artSrc(art, variant)}
        alt={`${art.title}, ${art.artist}`}
        width={art.width}
        height={art.height}
        priority={priority}
        sizes="(max-width: 640px) 100vw, 576px"
        className="h-auto w-full"
      />
      <figcaption>
        <ArtCredit art={art} className="mt-2" />
      </figcaption>
    </figure>
  );
}

/** Œuvre en fond plein écran, assombrie (aplat, pas de dégradé). */
export function ArtBackdrop({ slug, children }: { slug: string | null | undefined; children: React.ReactNode }) {
  const art = getArt(slug);
  return (
    <div className="relative min-h-dvh overflow-hidden">
      {art ? (
        <>
          {/* Pas de `fill` : il pose un style en ligne, bloqué par la CSP stricte. */}
          <Image
            src={artSrc(art, "nb")}
            alt=""
            width={art.width}
            height={art.height}
            priority
            sizes="100vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-ink/70" />
        </>
      ) : null}
      <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
      {art ? <ArtCredit art={art} className="absolute right-4 bottom-3 left-4 z-10 text-right" /> : null}
    </div>
  );
}
