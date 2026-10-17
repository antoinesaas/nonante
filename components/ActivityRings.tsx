export type RingTone = "rose" | "mint" | "sky" | "amber" | "violet" | "blue";

export type RingValue = { value: number; max: number; tone: RingTone };

// Dégradé de chaque anneau (du début à la fin du trait) et couleur de la piste.
const GRADIENT: Record<RingTone, [string, string]> = {
  rose: ["#ff2d6f", "#ff7aa8"],
  mint: ["#2fd48f", "#b6ff7a"],
  sky: ["#1f8bff", "#6fe3ff"],
  amber: ["#ff8a1f", "#ffd35c"],
  violet: ["#7b4dff", "#d08bff"],
  blue: ["#2f5bff", "#7aa8ff"],
};

/** Cercle complet en un seul chemin (départ en haut, sens horaire), longueur normalisée à 100. */
function circle(r: number, c: number): string {
  return `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - 0.01} ${c - r}`;
}

/**
 * Anneaux d'activité façon Apple Forme : un anneau par mesure, du plus grand au plus petit. Chacun part de zéro et
 * se remplit jusqu'à sa valeur (CSS seul, pas de style en ligne : CSP stricte). Au-delà de 100 %, l'anneau reste plein.
 */
export function ActivityRings({
  rings,
  size = 168,
  stroke = 18,
  gap = 4,
  label,
  className = "",
  animate = true,
}: {
  rings: RingValue[];
  size?: number;
  stroke?: number;
  gap?: number;
  label: string;
  className?: string;
  /** Remplissage animé à l'apparition ; sans, l'anneau suit sa valeur en direct (écran de construction). */
  animate?: boolean;
}) {
  const c = size / 2;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={className}
    >
      <defs>
        {rings.map((ring, i) => (
          <linearGradient key={i} id={`ring-${ring.tone}-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={GRADIENT[ring.tone][0]} />
            <stop offset="100%" stopColor={GRADIENT[ring.tone][1]} />
          </linearGradient>
        ))}
      </defs>
      {rings.map((ring, i) => {
        const r = c - stroke / 2 - i * (stroke + gap);
        if (r <= stroke / 2) return null;
        const pct = ring.max > 0 ? Math.max(0, Math.min(1, ring.value / ring.max)) : 0;
        const d = circle(r, c);
        return (
          <g key={i}>
            <path d={d} pathLength={100} fill="none" stroke={GRADIENT[ring.tone][0]} strokeOpacity={0.2} strokeWidth={stroke} />
            {pct > 0 ? (
              <path
                d={d}
                pathLength={100}
                fill="none"
                stroke={`url(#ring-${ring.tone}-${size})`}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray="100 100"
                strokeDashoffset={100 - Math.max(pct * 100, 1.5)}
                className={animate ? "ring-fill" : "transition-[stroke-dashoffset] duration-300 ease-out"}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Couleur de texte d'un anneau (légendes). */
export const RING_TEXT: Record<RingTone, string> = {
  rose: "text-[#ff4f86]",
  mint: "text-[#5cf0a6]",
  sky: "text-[#4fc3ff]",
  amber: "text-[#ffb340]",
  violet: "text-[#b28bff]",
  blue: "text-[#7aa8ff]",
};
