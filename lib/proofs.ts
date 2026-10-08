import type { ProofType } from "@/lib/types";

// Règles des preuves partagées par l'app (les libellés sont dans les textes : m.game.proof).

export const STRONG_PROOFS: ProofType[] = ["session", "reps", "reveil"];

export function isStrong(proof: ProofType): boolean {
  return STRONG_PROOFS.includes(proof);
}

/** Page de preuve d'un principe (null : validation directe depuis le tableau de bord). */
export function proofHref(proof: ProofType, principleId: string): string | null {
  switch (proof) {
    case "session":
      return `/app/session/${principleId}`;
    case "reps":
      return `/app/reps/${principleId}`;
    case "reveil":
      return `/app/reveil/${principleId}`;
    case "photo":
    case "capture":
      return `/app/photo/${principleId}`;
    case "lien":
      return `/app/lien/${principleId}`;
    default:
      return null;
  }
}

export const LINK_DOMAINS = [
  "tiktok.com", "instagram.com", "youtube.com", "linkedin.com", "x.com", "twitter.com", "threads.net", "facebook.com",
  "github.com", "medium.com", "substack.com", "producthunt.com", "behance.net", "dribbble.com", "twitch.tv",
  "spotify.com", "pinterest.com", "reddit.com",
];
