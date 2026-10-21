"use client";

import { useEffect, useRef } from "react";

/** Durées proposées : de 10 à 180 minutes, par pas de 5 (comme `_valid_minutes` en SQL). */
export const DURATIONS = Array.from({ length: 35 }, (_, i) => 10 + i * 5);
const ITEM = 64;

/**
 * Sélecteur de durée qu'on fait glisser (roue horizontale façon iOS) : la valeur au centre est choisie.
 * Défilement natif avec aimantation (fluide, avec l'élan du doigt) ; un toucher sur une valeur y va aussi.
 */
export function DurationPicker({
  value,
  onChange,
  label,
  unit,
  values = DURATIONS,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  unit: string;
  /** Valeurs proposées (durées par défaut ; aussi le nombre de répétitions). */
  values?: number[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const current = useRef(value);

  // Position de départ : la durée du principe au centre, sans animation.
  useEffect(() => {
    const el = ref.current;
    const i = values.indexOf(current.current);
    if (el && i >= 0) el.scrollLeft = i * ITEM;
    // Position de départ seulement : la suite vient du doigt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go(n: number, smooth = true) {
    const i = values.indexOf(n);
    if (i >= 0) ref.current?.scrollTo({ left: i * ITEM, behavior: smooth ? "smooth" : "instant" });
  }

  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute top-0 left-1/2 h-full w-[60px] -translate-x-1/2 rounded-2xl bg-white/[0.07] shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" />
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={values[0]}
        aria-valuemax={values[values.length - 1]}
        aria-valuenow={value}
        aria-valuetext={`${value} ${unit}`}
        onScroll={(e) => {
          const i = Math.max(0, Math.min(values.length - 1, Math.round(e.currentTarget.scrollLeft / ITEM)));
          const n = values[i];
          if (n !== current.current) {
            current.current = n;
            onChange(n);
          }
        }}
        onKeyDown={(e) => {
          const i = values.indexOf(value);
          if (e.key === "ArrowRight" || e.key === "ArrowUp") go(values[Math.min(values.length - 1, i + 1)]);
          else if (e.key === "ArrowLeft" || e.key === "ArrowDown") go(values[Math.max(0, i - 1)]);
          else return;
          e.preventDefault();
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-[calc(50%-32px)] outline-none [mask-image:linear-gradient(to_right,transparent,#000_30%,#000_70%,transparent)] [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-white/50 [&::-webkit-scrollbar]:hidden"
      >
        {values.map((n) => {
          const on = n === value;
          return (
            <button
              key={n}
              type="button"
              tabIndex={-1}
              onClick={() => go(n)}
              className="flex h-16 w-16 shrink-0 snap-center flex-col items-center justify-center"
            >
              <span className={`font-display tabular-nums transition-all duration-200 ${on ? "text-[26px] text-paper" : n % 30 === 0 ? "text-[17px] text-paper/55" : "text-[15px] text-paper/35"}`}>{n}</span>
              <span className={`text-[10px] font-medium transition-opacity duration-200 ${on ? "text-mute opacity-100" : "opacity-0"}`}>{unit}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
