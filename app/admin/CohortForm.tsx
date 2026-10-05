"use client";

import { useActionState } from "react";
import { saveCohort } from "@/app/actions/admin";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { btnSecondary, input } from "@/lib/ui";

type Cohort = {
  id: string;
  name: string;
  start_date: string;
  enroll_open: boolean;
  is_test: boolean;
  price_cents: number;
  early_price_cents: number;
};

export function CohortForm({ cohort }: { cohort: Cohort | null }) {
  const [state, action] = useActionState(saveCohort, idle);
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      {cohort ? <input type="hidden" name="id" value={cohort.id} /> : null}
      <label className="block sm:col-span-2">
        <span className="text-xs text-mute">Nom</span>
        <input name="name" required defaultValue={cohort?.name ?? ""} className={`${input} mt-1`} />
      </label>
      <label className="block">
        <span className="text-xs text-mute">Départ (90 jours)</span>
        <input name="startDate" type="date" required defaultValue={cohort?.start_date ?? ""} className={`${input} mt-1`} />
      </label>
      <div className="flex items-end gap-6 pb-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="enrollOpen" defaultChecked={cohort?.enroll_open ?? true} className="size-4 accent-paper" />
          Inscriptions ouvertes
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isTest" defaultChecked={cohort?.is_test ?? false} className="size-4 accent-paper" />
          Test
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-mute">Prix (€)</span>
        <input name="price" inputMode="decimal" required defaultValue={cohort ? cohort.price_cents / 100 : 19} className={`${input} mt-1`} />
      </label>
      <label className="block">
        <span className="text-xs text-mute">Prix early bird (€)</span>
        <input
          name="earlyPrice"
          inputMode="decimal"
          required
          defaultValue={cohort ? cohort.early_price_cents / 100 : 15}
          className={`${input} mt-1`}
        />
      </label>
      <div className="sm:col-span-2">
        <SubmitButton className={btnSecondary} pendingLabel="Enregistrement…">
          Enregistrer
        </SubmitButton>
        <FormMessage message={state.message} ok={state.ok} />
      </div>
    </form>
  );
}
