"use client";

import { useActionState } from "react";
import { grantComp, saveSquad } from "@/app/actions/admin";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { btnSecondary, input, label } from "@/lib/ui";

export function CompForm() {
  const [state, formAction] = useActionState(grantComp, idle);
  return (
    <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-4">
      <label className="block sm:col-span-2">
        <span className={label}>Pseudo</span>
        <input name="pseudo" required className={`${input} mt-2`} />
      </label>
      <label className="block">
        <span className={label}>Plan</span>
        <select name="plan" defaultValue="pro" className={`${input} mt-2`}>
          <option value="pro">Pro</option>
          <option value="essentiel">Essentiel</option>
        </select>
      </label>
      <label className="block">
        <span className={label}>Jusqu&apos;au (vide : retirer)</span>
        <input name="until" type="date" className={`${input} mt-2`} />
      </label>
      <div className="sm:col-span-4">
        <SubmitButton className={btnSecondary} pendingLabel="…">
          Enregistrer l&apos;accès
        </SubmitButton>
        <FormMessage message={state.message} ok={state.ok} />
      </div>
    </form>
  );
}

export function SquadForm({
  squad,
}: {
  squad: { id: string; name: string; description: string | null; start_date: string | null; is_public: boolean } | null;
}) {
  const [state, formAction] = useActionState(saveSquad, idle);
  return (
    <form action={formAction} className="mt-4 space-y-3">
      {squad ? <input type="hidden" name="id" value={squad.id} /> : null}
      <label className="block">
        <span className={label}>Nom</span>
        <input name="name" defaultValue={squad?.name ?? ""} required maxLength={40} className={`${input} mt-2`} />
      </label>
      <label className="block">
        <span className={label}>Description</span>
        <input name="description" defaultValue={squad?.description ?? ""} maxLength={160} className={`${input} mt-2`} />
      </label>
      <label className="block">
        <span className={label}>Départ collectif (facultatif)</span>
        <input name="startDate" type="date" defaultValue={squad?.start_date ?? ""} className={`${input} mt-2`} />
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="isPublic" defaultChecked={squad?.is_public ?? true} className="size-5 accent-paper" />
        Publique
      </label>
      <SubmitButton className={btnSecondary} pendingLabel="…">
        Enregistrer
      </SubmitButton>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}
