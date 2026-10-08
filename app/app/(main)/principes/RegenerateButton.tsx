"use client";

import { useState, useTransition } from "react";
import { regeneratePrinciples } from "@/app/actions/principles";
import { useI18n } from "@/components/I18nProvider";
import { Sheet } from "@/components/Sheet";
import { btnLink, btnPrimary, btnSecondary } from "@/lib/ui";

export function RegenerateButton() {
  const { m } = useI18n();
  const t = m.app.principles;
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="text-right">
      <button type="button" disabled={pending} onClick={() => setOpen(true)} className={btnLink}>
        {pending ? "…" : t.regenerate}
      </button>
      {message ? <span className="block animate-rise text-xs text-mute">{message}</span> : null}
      <Sheet open={open} onClose={() => setOpen(false)} title={t.regenerateTitle}>
        <p className="mt-2 text-left text-sm text-mute">{t.regenerateText}</p>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              startTransition(async () => setMessage((await regeneratePrinciples()).message));
            }}
            className={btnPrimary}
          >
            {t.regenerateConfirm}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={`${btnSecondary} w-full`}>
            {m.common.actions.cancel}
          </button>
        </div>
      </Sheet>
    </span>
  );
}
