export type AuraTone = "rose" | "mint" | "sky" | "amber" | "violet";

const TONES: Record<AuraTone, string> = {
  rose: "aura-rose",
  mint: "aura-mint",
  sky: "aura-sky",
  amber: "aura-amber",
  violet: "aura-violet",
};

/**
 * Taches de couleur floues derrière l'en-tête d'un écran (à la place des photos) : elles dérivent très lentement.
 * Le parent doit être `relative` ; le contenu passe au-dessus (z-10).
 */
export function Aura({ tone = "rose", className = "" }: { tone?: AuraTone; className?: string }) {
  return <div aria-hidden="true" className={`aura ${TONES[tone]} ${className}`} />;
}
