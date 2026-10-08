"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/app/actions/profile";
import { useI18n } from "@/components/I18nProvider";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { fmt } from "@/lib/i18n/format";
import { btnLink, btnSecondary, input } from "@/lib/ui";

export function DeleteAccountForm({ pseudo }: { pseudo: string }) {
  const { m } = useI18n();
  const t = m.app.profile;
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteAccount, idle);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btnLink} mt-6 inline-block`}>
        {t.delete}
      </button>
    );
  }
  return (
    <form action={action} className="mt-6 space-y-3 border border-line p-4">
      <p className="text-sm">{t.deleteText}</p>
      <label className="block">
        <span className="text-sm text-mute">{fmt(t.deleteConfirm, { pseudo })}</span>
        <input name="confirm" autoComplete="off" autoCapitalize="none" className={`${input} mt-2`} />
      </label>
      <SubmitButton className={btnSecondary} pendingLabel={t.deleting}>
        {t.deleteButton}
      </SubmitButton>
      <FormMessage message={state.message} />
    </form>
  );
}
