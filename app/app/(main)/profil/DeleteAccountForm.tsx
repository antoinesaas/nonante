"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/app/actions/profile";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { btnLink, btnSecondary, input } from "@/lib/ui";

export function DeleteAccountForm({ pseudo }: { pseudo: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteAccount, idle);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btnLink} mt-6 inline-block`}>
        Supprimer mon compte
      </button>
    );
  }
  return (
    <form action={action} className="mt-6 space-y-3 border border-line p-4">
      <p className="text-sm">
        Tout sera supprimé : profil, principes, preuves, points, succès. Les paiements restent dans la comptabilité, détachés de
        ton compte. C&apos;est définitif.
      </p>
      <label className="block">
        <span className="text-sm text-mute">Recopie « {pseudo} » pour confirmer</span>
        <input name="confirm" autoComplete="off" autoCapitalize="none" className={`${input} mt-2`} />
      </label>
      <SubmitButton className={btnSecondary} pendingLabel="Suppression…">
        Supprimer définitivement
      </SubmitButton>
      <FormMessage message={state.message} />
    </form>
  );
}
