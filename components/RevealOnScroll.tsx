"use client";

import { useEffect } from "react";

/**
 * Fait apparaître en douceur, une seule fois, les éléments marqués `data-reveal` quand ils arrivent à l'écran.
 * Ce qui est déjà visible au chargement s'affiche tout de suite (pas de clignotement). Sans JavaScript : tout est visible.
 */
export function RevealOnScroll() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-shown])"));
    if (!items.length || !("IntersectionObserver" in window)) return;
    const fold = window.innerHeight;
    for (const el of items) {
      if (el.getBoundingClientRect().top < fold) el.dataset.shown = "";
    }
    document.documentElement.classList.add("reveal-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.shown = "";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    for (const el of items) if (!("shown" in el.dataset)) observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("reveal-ready");
    };
  }, []);
  return null;
}
