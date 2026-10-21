"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendExitFeedback } from "@/app/actions/feedback";
import { useI18n } from "@/components/I18nProvider";
import { Sheet } from "@/components/Sheet";
import { trackEvent } from "@/lib/track";
import { btnPrimary, btnSecondary, input } from "@/lib/ui";

const REASONS = ["prix", "moment", "doute", "essai", "confiance", "autre"] as const;
type Reason = (typeof REASONS)[number];

/**
 * « Avant de partir… » : une seule fois par visite, quand le visiteur fait demi-tour juste avant de payer
 * (geste ou bouton retour, ou souris qui file vers la barre d'adresse sur ordinateur). Une marque est posée dans
 * l'historique : le premier retour la consomme et ouvre la feuille au lieu de quitter la page.
 * La réponse (raison + message facultatif) part dans Supabase (exit_feedback), lue dans /admin/entonnoir.
 */
export function ExitSurvey({ place }: { place: "resultat" | "suite" }) {
  const { m } = useI18n();
  const t = m.quiz.exit;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const asked = useRef(false);

  useEffect(() => {
    const ask = () => {
      if (asked.current) return;
      asked.current = true;
      setOpen(true);
      trackEvent("depart", { page: place });
    };
    // Marque dans l'historique (même adresse) : le retour la retire et reste sur la page.
    window.history.pushState({ ...window.history.state, nonanteExit: place }, "", window.location.href);
    const onPopState = () => ask();
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget && e.clientY <= 0) ask();
    };
    window.addEventListener("popstate", onPopState);
    document.addEventListener("mouseout", onMouseOut);
    return () => {
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("mouseout", onMouseOut);
    };
  }, [place]);

  function send() {
    if (!reason) return;
    startTransition(async () => {
      await sendExitFeedback(place, reason, message.trim());
      setSent(true);
    });
  }

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title={sent ? t.thanksTitle : t.title}>
      {sent ? (
        <div className="pb-2">
          <p className="text-[15px] text-mute">{t.thanks}</p>
          <button type="button" onClick={() => setOpen(false)} className={`${btnPrimary} mt-6`}>
            {t.stay}
          </button>
        </div>
      ) : (
        <div className="pb-2">
          <p className="text-[15px] text-mute">{t.text}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
                className={`press rounded-full px-3.5 py-2 text-left text-sm font-medium ${reason === r ? "pearl" : "liquid text-paper/85"}`}
              >
                {t.reasons[r]}
              </button>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="sr-only">{t.placeholder}</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              placeholder={t.placeholder}
              className={`${input} h-auto min-h-24 resize-none py-3`}
            />
          </label>
          <div className="mt-5 space-y-3">
            <button type="button" onClick={send} disabled={!reason || pending} className={btnPrimary}>
              {pending ? t.sending : t.send}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={`${btnSecondary} w-full`}>
              {t.stay}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
