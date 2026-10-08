"use client";

import { useEffect, useRef, useState } from "react";
import { INTL, type Locale } from "@/lib/i18n/config";

/** Nombre qui monte jusqu'à sa valeur quand il apparaît à l'écran (valeur finale lisible sans JavaScript). */
export function CountUp({ value, duration = 1200, className = "", locale = "fr" }: { value: number; duration?: number; className?: string; locale?: Locale }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        setShown(0);
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {shown.toLocaleString(INTL[locale])}
    </span>
  );
}
