"use client";

import { useRef } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { Pad } from "@/lib/ambience";
import { fmt } from "@/lib/i18n/format";

const GRID = [12.5, 25, 37.5, 50, 62.5, 75, 87.5];

/**
 * Pavé de réglage du son (comme Endel) : on fait glisser le point. Haut = intense, bas = calme,
 * gauche = fluide, droite = structuré. Dessiné en SVG : la position du point passe par des attributs, pas par du
 * style en ligne (CSP stricte). Flèches du clavier pour le régler sans le doigt.
 */
export function SoundPad({ value, onChange, onCommit }: { value: Pad; onChange: (p: Pad) => void; onCommit: (p: Pad) => void }) {
  const { m } = useI18n();
  const t = m.app.timer.pad;
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(value);
  const cx = 6 + value.x * 88;
  const cy = 6 + (1 - value.y) * 88;

  function at(e: React.PointerEvent): Pad {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)),
    };
  }

  function move(p: Pad) {
    last.current = p;
    onChange(p);
  }

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={t.title}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value.y * 100)}
      aria-valuetext={fmt(t.value, { e: Math.round(value.y * 100), s: Math.round(value.x * 100) })}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        move(at(e));
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) move(at(e));
      }}
      onPointerUp={() => onCommit(last.current)}
      onPointerCancel={() => onCommit(last.current)}
      onKeyDown={(e) => {
        const step = 0.05;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
        if (!d) return;
        e.preventDefault();
        const p = { x: Math.max(0, Math.min(1, value.x + d[0])), y: Math.max(0, Math.min(1, value.y + d[1])) };
        move(p);
        onCommit(p);
      }}
      className="relative mx-auto aspect-square w-full max-w-[52dvh] cursor-pointer touch-none select-none rounded-[2.25rem] outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <radialGradient id="pad-glow" gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r="58">
            <stop offset="0" stopColor="#b79bff" stopOpacity="0.55" />
            <stop offset="0.45" stopColor="#8358e8" stopOpacity="0.18" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <clipPath id="pad-clip">
            <rect width="100" height="100" rx="18" />
          </clipPath>
        </defs>
        <g clipPath="url(#pad-clip)">
          <rect width="100" height="100" fill="#141416" />
          <rect width="100" height="100" fill="url(#pad-glow)" />
          {GRID.map((g) => (
            <g key={g} stroke="#fff" strokeOpacity="0.09" strokeWidth="0.3">
              <line x1={g} y1="0" x2={g} y2="100" />
              <line x1="0" y1={g} x2="100" y2={g} />
            </g>
          ))}
        </g>
        <rect x="0.25" y="0.25" width="99.5" height="99.5" rx="18" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="0.5" />
        <circle cx={cx} cy={cy} r="11" fill="#b79bff" fillOpacity="0.18" />
        <circle cx={cx} cy={cy} r="7" fill="#fff" fillOpacity="0.9" stroke="#fff" strokeWidth="1.4" />
      </svg>
      <span className="pointer-events-none absolute inset-x-0 top-3.5 text-center text-[11px] font-semibold tracking-[0.18em] text-paper/60 uppercase">{t.intense}</span>
      <span className="pointer-events-none absolute inset-x-0 bottom-3.5 text-center text-[11px] font-semibold tracking-[0.18em] text-paper/60 uppercase">{t.calm}</span>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 rotate-180 text-[11px] font-semibold tracking-[0.18em] text-paper/60 uppercase [writing-mode:vertical-rl]">{t.fluid}</span>
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] font-semibold tracking-[0.18em] text-paper/60 uppercase [writing-mode:vertical-rl]">{t.structured}</span>
    </div>
  );
}
