"use client";

import { useEffect } from "react";

// Champs de saisie : jamais de retour haptique (sur iPhone, l'astuce de l'interrupteur leur volerait le focus).
const TYPING = 'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea, select, [contenteditable=""], [contenteditable="true"]';

const TARGETS = 'button, a[href], [role="button"], [role="tab"], summary, label, select, input[type="checkbox"], input[type="radio"], input[type="submit"]';

/**
 * Petit retour haptique à chaque appui sur un bouton ou un lien.
 * Android : navigator.vibrate. iPhone (Safari 18+, sans vibrate) : un interrupteur natif caché
 * (<input type="checkbox" switch>) basculé par son label, qui fait vibrer le Taptic Engine.
 * Rien d'autre ne change : sans prise en charge, l'appui reste silencieux. Les champs de saisie sont exclus, et le
 * focus est rendu au champ actif : sinon le clavier se fermait (questionnaire, principes, notes).
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
      const target = e.target as Element | null;
      if (!target?.closest || target.closest(TYPING)) return;
      const el = target.closest(TARGETS);
      if (!el || el.closest("[data-haptic-ignore]") || el.matches(":disabled, [aria-disabled='true']")) return;
      // Label d'un champ de saisie : l'appui sert à écrire, pas de vibration.
      if (el instanceof HTMLLabelElement && el.control?.matches(TYPING)) return;
      const now = Date.now();
      if (now - last < 60) return;
      last = now;
      if (canVibrate) {
        navigator.vibrate(8);
        return;
      }
      // Cliquer le label donne le focus à l'interrupteur caché : on le rend aussitôt à l'élément qui l'avait.
      const focused = document.activeElement;
      label?.click();
      if (focused instanceof HTMLElement && focused !== document.body && document.activeElement !== focused) focused.focus({ preventScroll: true });
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      label?.parentElement?.remove();
    };
  }, []);
  return null;
}
