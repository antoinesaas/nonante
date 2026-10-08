"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/components/I18nProvider";

/**
 * Feuille qui monte du bas (centrée sur ordinateur), sur un <dialog> natif : focus piégé, Échap et
 * geste retour d'Android la ferment, fond cliquable pour fermer.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { m } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none bg-transparent p-0 text-paper backdrop:bg-ink/70 open:animate-sheet sm:m-auto sm:max-w-md sm:open:animate-pop"
    >
      <div className="max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-surface px-5 pt-3 sm:rounded-2xl sm:border">
        <div className="flex items-center justify-between gap-4">
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-line sm:hidden" />
          <button type="button" onClick={onClose} aria-label={m.common.actions.close} className="-mr-2 ml-auto grid size-10 place-items-center text-mute hover:text-paper">
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
              <path d="M4 4 L12 12 M12 4 L4 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <h2 className="font-serif text-3xl leading-tight">{title}</h2>
        {children}
        {/* Marge du bas en élément (pas en padding) : un bouton collant reste vraiment collé au bas de la feuille. */}
        <div aria-hidden="true" className="h-[max(1.5rem,env(safe-area-inset-bottom))]" />
      </div>
    </dialog>
  );
}
