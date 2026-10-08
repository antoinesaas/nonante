import Image from "next/image";
import { artSrc, getArt } from "@/lib/art";

/**
 * Image en fond plein écran : elle se fond dans le noir en bas (masque), un voile garde le texte lisible,
 * sans animation continue (fluidité au défilement). Les crédits sont sur la page /art, jamais sur l'image.
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
            className="absolute inset-0 h-full w-full object-cover"
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
  inner = "p-5 pt-10",
}: {
  slug: string;
  className?: string;
  children?: React.ReactNode;
  dark?: boolean;
  /** Marges du contenu (pleine largeur : « py-8 », le contenu pose son propre conteneur). */
  inner?: string;
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
      {children ? <div className={`relative z-10 flex h-full flex-col justify-end ${inner}`}>{children}</div> : null}
    </div>
  );
}
