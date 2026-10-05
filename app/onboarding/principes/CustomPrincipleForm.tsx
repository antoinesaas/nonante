"use client";

import { useActionState } from "react";
import { setCustomPrinciple } from "@/app/actions/onboarding";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { btnSecondary, input } from "@/lib/ui";

export function CustomPrincipleForm() {
  const [state, action] = useActionState(setCustomPrinciple, idle);
  return (
    <form action={action} className="mt-5 space-y-3">
      <label className="block">
        <span className="text-sm text-mute">Si…</span>
        <input name="if" required maxLength={80} placeholder="je rentre chez moi" className={`${input} mt-2`} />
      </label>
      <label className="block">
        <span className="text-sm text-mute">alors…</span>
        <input name="then" required maxLength={120} placeholder="je range mon bureau" className={`${input} mt-2`} />
      </label>
      <SubmitButton className={btnSecondary} pendingLabel="Ajout…">
        Ajouter
      </SubmitButton>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}
