import { ArcMark } from "@/components/Logo";

/**
 * Écran d'ouverture de l'app : fond noir, le symbole au centre et un anneau en dégradé qui tourne, puis tout s'efface
 * (CSS seul, une seule fois par chargement : la navigation dans l'app ne le rejoue pas). Évite l'écran noir vide.
 */
export function Splash() {
  return (
    <div aria-hidden="true" className="splash">
      <div className="relative grid size-28 place-items-center">
        <svg viewBox="0 0 112 112" className="splash-ring absolute inset-0 size-28">
          <defs>
            <linearGradient id="splash-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c9b3ff" />
              <stop offset="60%" stopColor="#9b6bff" />
              <stop offset="100%" stopColor="#9b6bff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle cx="56" cy="56" r="50" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="4" />
          <path d="M56 6 A50 50 0 1 1 6 56" fill="none" stroke="url(#splash-grad)" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <ArcMark className="splash-mark size-11 text-paper" />
      </div>
    </div>
  );
}
