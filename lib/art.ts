import credits from "@/public/art/credits.json";

export type Artwork = {
  slug: string;
  /**
   * « photo » : photo CC0 ou domaine public (Openverse) ; « fournie » : image choisie et fournie par l'éditeur
   * (pas de crédit public) ; absent : œuvre du domaine public (Wikimedia).
   */
  kind?: "photo" | "fournie";
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
  return variant === "couleur" && !art.kind ? `/art/${art.slug}.jpg` : `/art/${art.slug}-nb.jpg`;
}

/** Où va chaque image dans l'app. */
export const IMAGES = {
  hero: "nuit-tours",
  // Page de connexion : sans image (fond noir).
  onboarding: ["fenetre-allumee", "pion-roi", "sommet", "pluie-nuit", "aube", "piste", "carnet"],
  paywall: "bar-marbre",
  pains: "fenetre-allumee",
  steps: "pion-roi",
  proofs: "capuche-ordi",
  wallet: "billet",
  grades: "carnet",
  squads: "oiseau-seul",
  mood: "plan-humeur",
  founder: "etiquettes",
  body: "halteres",
  quote: "marc-aurele",
  levelUp: "escalier",
  arcDone: "adams-tetons",
  road: "route",
} as const;

export const DEFAULT_PROFILE_ART = "nuit-tours";
