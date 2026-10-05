import credits from "@/public/art/credits.json";

export type Artwork = {
  slug: string;
  title: string;
  artist: string;
  year: string;
  license: string;
  source: string;
  width: number;
  height: number;
};

const ARTWORKS = credits as Artwork[];

/** Œuvre téléchargée et vérifiée par scripts/fetch-art.ts, ou null si absente. */
export function getArt(slug: string | null | undefined): Artwork | null {
  if (!slug) return null;
  return ARTWORKS.find((a) => a.slug === slug) ?? null;
}

export function allArt(): Artwork[] {
  return ARTWORKS;
}

/** Image d'une œuvre : couleur ou noir et blanc granulé. */
export function artSrc(art: Artwork, variant: "couleur" | "nb" = "nb"): string {
  return variant === "nb" ? `/art/${art.slug}-nb.jpg` : `/art/${art.slug}.jpg`;
}

export const ONBOARDING_ART = { first: "friedrich-moine", last: "turner-norham" } as const;
export const LEVEL_ART: Record<number, string> = { 2: "friedrich-voyageur", 3: "turner-norham" };
export const DEFAULT_PROFILE_ART = "friedrich-moine";
