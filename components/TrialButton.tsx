"use client";

import { useActionState } from "react";
import { startTrial } from "@/app/actions/onboarding";
import { useI18n } from "@/components/I18nProvider";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { btnPrimary } from "@/lib/ui";

/** « Commencer mes 7 jours gratuits » (v19) : lance l'essai et l'arc en construction, sans carte bancaire. */
export function TrialButton({ className = btnPrimary }: { className?: string }) {
  const { m } = useI18n();
  const t = m.app.trial;
  const [state, action] = useActionState(startTrial, { message: null });
  return (
    <form action={action} className="space-y-2">
      <SubmitButton className={className} pendingLabel={t.starting}>
        {t.start}
      </SubmitButton>
      <p className="text-center text-xs text-mute">{t.noCard}</p>
      <FormMessage message={state.message} />
    </form>
  );
}
