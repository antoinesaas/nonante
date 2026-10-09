"use client";

import { useEffect } from "react";

const TARGETS = 'button, a[href], [role="button"], [role="tab"], summary, label, select, input[type="checkbox"], input[type="radio"], input[type="submit"]';

/**
 * Petit retour haptique à chaque appui sur un bouton ou un lien.
 * Android : navigator.vibrate. iPhone (Safari 18+, sans vibrate) : un interrupteur natif caché
 * (<input type="checkbox" switch>) basculé par son label, qui fait vibrer le Taptic Engine.
 * Rien d'autre ne change : sans prise en charge, l'appui reste silencieux.
 */
export function Haptics() {
  useEffect(() => {
    const canVibrate = typeof navigator.vibrate === "function";
    let label: HTMLLabelElement | null = null;
    if (!canVibrate) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = "nonante-haptic";
      input.setAttribute("switch", "");
      input.setAttribute("aria-hidden", "true");
      input.tabIndex = -1;
      label = document.createElement("label");
      label.htmlFor = input.id;
      label.setAttribute("aria-hidden", "true");
      const box = document.createElement("div");
      box.dataset.hapticIgnore = "";
      // Styles posés par le CSSOM (permis par la CSP) : hors de vue, sans gêner la mise en page.
      Object.assign(box.style, { position: "fixed", left: "-100px", top: "0", width: "1px", height: "1px", overflow: "hidden", opacity: "0", pointerEvents: "none" });
      box.append(input, label);
      document.body.append(box);
    }
    let last = 0;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(TARGETS);
      if (!el || el.closest("[data-haptic-ignore]") || el.matches(":disabled, [aria-disabled='true']")) return;
      const now = Date.now();
      if (now - last < 60) return;
      last = now;
      if (canVibrate) navigator.vibrate(8);
      else label?.click();
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      label?.parentElement?.remove();
    };
  }, []);
  return null;
}
