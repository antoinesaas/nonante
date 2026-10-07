import Image from "next/image";
import { artSrc, creditLine, getArt, type Artwork } from "@/lib/art";

export function ArtCredit({ art, className = "" }: { art: Artwork; className?: string }) {
  return <p className={`text-[10px] leading-snug text-mute ${className}`}>{creditLine(art)}</p>;
}

/** Image en pleine largeur avec son crédit. Rien si l'image n'a pas été téléchargée. */
export function ArtFigure({
  slug,
  variant = "nb",
  priority = false,
  className = "",
  imgClassName = "h-auto w-full",
}: {
  slug: string | null | undefined;
  variant?: "couleur" | "nb";
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  const art = getArt(slug);
  if (!art) return null;
  return (
    <figure className={className}>
      <Image
        src={artSrc(art, variant)}
        alt={art.kind === "photo" ? "" : `${art.title}, ${art.artist}`}
        width={art.width}
        height={art.height}
        priority={priority}
        sizes="(max-width: 640px) 100vw, 576px"
        className={imgClassName}
      />
      <figcaption>
        <ArtCredit art={art} className="mt-2" />
      </figcaption>
    </figure>
  );
}

/**
 * Image en fond plein écran : elle se fond dans le noir en bas (masque), un voile garde le texte lisible,
 * un zoom très lent la fait vivre. Les crédits sont sur la page /art, jamais sur l'image.
 */
export function ArtBackdrop({
  slug,
  children,
  tone = "dark",
  className = "min-h-dvh",
}: {
  slug: string | null | undefined;
  children: React.ReactNode;
  tone?: "dark" | "medium";
  className?: string;
}) {
  const art = getArt(slug);
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {art ? (
        <div aria-hidden="true" className="fade-bottom absolute inset-0">
          {/* Pas de `fill` : il pose un style en ligne, bloqué par la CSP stricte. */}
          <Image
            src={artSrc(art, "nb")}
            alt=""
            width={art.width}
            height={art.height}
            priority
            sizes="100vw"
            className="absolute inset-0 h-full w-full animate-drift object-cover"
          />
          <div className={`absolute inset-0 ${tone === "dark" ? "bg-ink/70" : "bg-ink/45"}`} />
          <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-ink/80 to-ink/0" />
          <div className="vignette absolute inset-0" />
        </div>
      ) : null}
      <div className="relative z-10 flex h-full min-h-[inherit] flex-col">{children}</div>
    </div>
  );
}

/** Bandeau photo entre deux sections : il se fond dans le noir en haut et en bas, sans bord net. */
export function ArtBand({
  slug,
  className = "h-56",
  children,
  dark = false,
}: {
  slug: string;
  className?: string;
  children?: React.ReactNode;
  dark?: boolean;
}) {
  const art = getArt(slug);
  if (!art) return children ? <div className={className}>{children}</div> : null;
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div aria-hidden="true" className="fade-y absolute inset-0 grain">
        <Image
          src={artSrc(art, "nb")}
          alt=""
          width={art.width}
          height={art.height}
          sizes="(max-width: 640px) 100vw, 576px"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className={`absolute inset-0 ${dark ? "bg-ink/70" : "bg-ink/35"}`} />
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-ink via-ink/60 to-ink/0" />
      </div>
      {children ? <div className="relative z-10 flex h-full flex-col justify-end p-5 pt-10">{children}</div> : null}
    </div>
  );
}
