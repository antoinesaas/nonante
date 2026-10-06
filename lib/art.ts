import credits from "@/public/art/credits.json";

export type Artwork = {
  slug: string;
  /** « photo » : photo CC0 ou domaine public (Openverse) ; absent : œuvre du domaine public (Wikimedia). */
  kind?: "photo";
  title: string;
  artist: string;
  year: string;
  license: string;
  source: string;
  width: number;
  height: number;
};

const ARTWORKS = credits as Artwork[];

/** Image téléchargée et vérifiée par les scripts fetch-art / fetch-photos, ou null si absente. */
export function getArt(slug: string | null | undefined): Artwork | null {
  if (!slug) return null;
  return ARTWORKS.find((a) => a.slug === slug) ?? null;
}

export function allArt(): Artwork[] {
  return ARTWORKS;
}

/** Les photos n'existent qu'en noir et blanc ; les œuvres aussi en couleur. */
export function artSrc(art: Artwork, variant: "couleur" | "nb" = "nb"): string {
  return variant === "couleur" && art.kind !== "photo" ? `/art/${art.slug}.jpg` : `/art/${art.slug}-nb.jpg`;
}

/** Crédit court : « Matt Bango, City Building. CC0. » ou « Friedrich, Le Moine…, 1810. Domaine public. » */
export function creditLine(art: Artwork): string {
  if (art.kind === "photo") return `Photo : ${art.artist}. ${art.license}.`;
  return `${art.artist}, ${art.title}, ${art.year}. Domaine public.`;
}

/** Où va chaque image dans l'app. */
export const IMAGES = {
  hero: "nuit-tours",
  login: "fenetre",
  onboarding: ["fenetre", "echecs", "sommet", "pluie-nuit", "aube", "piste", "carnet"],
  paywall: "ville-nuit",
  proofs: "bureau-nuit",
  wallet: "billets",
  squads: "oiseaux-fil",
  body: "halteres",
  quote: "marc-aurele",
  levelUp: "escalier",
  arcDone: "adams-tetons",
  road: "route",
} as const;

export const DEFAULT_PROFILE_ART = "nuit-tours";
