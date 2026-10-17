"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/components/I18nProvider";

/**
 * Feuille qui monte du bas (centrée sur ordinateur), sur un <dialog> natif : focus piégé, Échap et
 * geste retour d'Android la ferment, fond cliquable pour fermer. En-tête fixe, contenu qui défile.
 * `bare` : le contenu gère lui-même son défilement (formulaire avec une barre de boutons toujours visible).
 */
export function Sheet({ open, onClose, title, children, bare = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; bare?: boolean }) {
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
      className="m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-hidden bg-transparent p-0 text-paper backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-sheet sm:m-auto sm:max-w-md sm:open:animate-pop"
    >
      <div className="flex max-h-[90dvh] flex-col rounded-t-[2rem] bg-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] sm:rounded-[2rem]">
        <div className="shrink-0 px-5 pt-2.5">
          <span aria-hidden="true" className="mx-auto block h-1.5 w-10 rounded-full bg-white/20 sm:hidden" />
          <div className="mt-2 flex items-center justify-between gap-4">
            <h2 className="font-display text-[22px] leading-tight">{title}</h2>
            <button type="button" onClick={onClose} aria-label={m.common.actions.close} className="liquid press -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-mute">
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                <path d="M4 4 L12 12 M12 4 L4 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        {bare ? (
          children
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4">
            {children}
            <div aria-hidden="true" className="h-[max(1.5rem,env(safe-area-inset-bottom))]" />
          </div>
        )}
      </div>
    </dialog>
  );
}
