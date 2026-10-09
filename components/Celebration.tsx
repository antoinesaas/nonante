"use client";

import { useState, useSyncExternalStore } from "react";
import { useI18n } from "@/components/I18nProvider";
import { btnPrimary } from "@/lib/ui";

export type CelebrationKind = "achievement" | "level" | "day" | "goal";

// Coordonnées arrondies : les sinus du serveur et du navigateur diffèrent au dernier chiffre (hydratation).
const at = (r: number, a: number) => [(120 + r * Math.cos(a)).toFixed(2), (120 + r * Math.sin(a)).toFixed(2)] as const;
const RAYS = Array.from({ length: 16 }, (_, i) => {
  const a = (i * Math.PI * 2) / 16;
  const [x1, y1] = at(62, a);
  const [x2, y2] = at(i % 2 ? 92 : 104, a);
  return { x1, y1, x2, y2, thin: i % 2 === 1 };
});
const SPARKS = [
  [42, 52],
  [196, 62],
  [210, 150],
  [34, 168],
  [120, 18],
  [150, 214],
] as const;

/** Pictogramme dessiné au trait au centre du disque. */
function Glyph({ kind }: { kind: CelebrationKind }) {
  const props = { pathLength: 1, className: "cel-draw", fill: "none", stroke: "var(--color-ink)", strokeWidth: 6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "achievement") return <path {...props} d="M120 92 L128.5 109.5 L147.5 112 L133.5 125 L137 144 L120 135 L103 144 L106.5 125 L92.5 112 L111.5 109.5 Z" />;
  if (kind === "level")
    return (
      <>
        <path {...props} d="M100 128 L120 108 L140 128" />
        <path {...props} d="M100 146 L120 126 L140 146" className="cel-draw cel-draw-late" />
      </>
    );
  if (kind === "goal")
    return (
      <>
        <circle {...props} cx="120" cy="120" r="24" />
        <circle {...props} cx="120" cy="120" r="11" className="cel-draw cel-draw-late" />
      </>
    );
  return <path {...props} d="M101 121 L114 134 L141 106" />;
}

/**
 * Emblème en motion design, noir et blanc : ondes de choc, rayons de lumière qui jaillissent, orbite qui tourne,
 * disque qui éclot avec un rebond, pictogramme dessiné au trait, reflet qui balaie, étincelles. CSS seulement
 * (CSP stricte), figé sur son état final si l'utilisateur réduit les animations.
 */
export function CelebrationBurst({ kind, className = "" }: { kind: CelebrationKind; className?: string }) {
  return (
    <svg viewBox="0 0 240 240" className={`cel ${className}`} aria-hidden="true">
      <defs>
        <clipPath id={`cel-disc-${kind}`}>
          <circle cx="120" cy="120" r="46" />
        </clipPath>
        <linearGradient id={`cel-glint-${kind}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="cel-rings">
        {[0, 1, 2].map((i) => (
          <circle key={i} cx="120" cy="120" r="50" fill="none" stroke="var(--color-paper)" strokeWidth="1.5" />
        ))}
      </g>
      <circle className="cel-orbit" cx="120" cy="120" r="78" fill="none" stroke="var(--color-paper)" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="2 9" />
      <g className="cel-rays">
        {RAYS.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="var(--color-paper)" strokeWidth={r.thin ? 1.5 : 2.5} strokeLinecap="round" />
        ))}
      </g>
      <g className="cel-sparks">
        {SPARKS.map(([x, y]) => (
          <path key={`${x}-${y}`} d={`M${x} ${y - 7} Q${x} ${y} ${x + 7} ${y} Q${x} ${y} ${x} ${y + 7} Q${x} ${y} ${x - 7} ${y} Q${x} ${y} ${x} ${y - 7} Z`} fill="var(--color-paper)" />
        ))}
      </g>
      <g className="cel-disc">
        <circle cx="120" cy="120" r="46" fill="var(--color-paper)" />
        <g clipPath={`url(#cel-disc-${kind})`}>
          <g transform="rotate(20 120 120)">
            <rect className="cel-glint" x="40" y="60" width="44" height="120" fill={`url(#cel-glint-${kind})`} />
          </g>
        </g>
        <Glyph kind={kind} />
      </g>
    </svg>
  );
}

/** Titre qui monte mot à mot. */
export function CelebrationTitle({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`cel-words ${className}`}>
      {text.split(" ").map((w, i) => (
        <span key={i}>{w}&nbsp;</span>
      ))}
    </span>
  );
}

const noSubscribe = () => () => {};

/**
 * Plein écran de fête, une seule fois par clé (journée prouvée, objectif atteint). La clé est gardée dans le
 * navigateur : en navigation privée, la fête peut revenir, sans gravité.
 */
export function CelebrationOverlay({ storageKey, kind, hand, title, text }: { storageKey: string; kind: CelebrationKind; hand: string; title: string; text: string }) {
  const { m } = useI18n();
  const unseen = useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return !localStorage.getItem(storageKey);
      } catch {
        return false;
      }
    },
    () => false,
  );
  const [closed, setClosed] = useState(false);
  if (!unseen || closed) return null;

  function close() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // Stockage indisponible : la fête se fermera quand même.
    }
    setClosed(true);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={close} className="cel-overlay fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/90 px-8 text-center backdrop-blur-md">
      <CelebrationBurst kind={kind} className="size-64" />
      <p className="mt-2 animate-rise font-hand text-3xl text-mute [animation-delay:500ms]">{hand}</p>
      <h2 className="mt-2 font-serif text-5xl leading-none">
        <CelebrationTitle text={title} />
      </h2>
      <p className="mt-5 max-w-sm animate-rise text-paper/80 [animation-delay:900ms]">{text}</p>
      <button type="button" autoFocus onClick={close} className={`${btnPrimary} mt-10 max-w-xs animate-rise [animation-delay:1100ms]`}>
        {m.common.actions.continue}
      </button>
    </div>
  );
}
