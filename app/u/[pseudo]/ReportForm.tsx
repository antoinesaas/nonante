"use client";

import { useActionState, useState } from "react";
import { reportUser } from "@/app/actions/profile";
import { useI18n } from "@/components/I18nProvider";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { btnLink, btnSecondary, input } from "@/lib/ui";

export function ReportForm({ pseudo }: { pseudo: string }) {
  const { m } = useI18n();
  const t = m.pages.publicProfile;
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(reportUser, idle);
  if (state.ok) return <p className="text-sm">{state.message}</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btnLink}>
        {t.report}
      </button>
    );
  }
  return (
    <form action={action} className="animate-rise space-y-3">
      <input type="hidden" name="pseudo" value={pseudo} />
      <label className="block">
        <span className="text-sm text-mute">{t.reportWhy}</span>
        <textarea name="reason" required minLength={3} maxLength={500} rows={3} className={`${input} mt-2 h-auto py-3`} />
      </label>
      <SubmitButton className={btnSecondary} pendingLabel={m.common.actions.sending}>
        {t.reportButton}
      </SubmitButton>
      <FormMessage message={state.message} />
    </form>
  );
}
