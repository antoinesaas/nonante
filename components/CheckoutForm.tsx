"use client";

import { useActionState } from "react";
import { startPresaleCheckout, type CheckoutState } from "@/app/actions/checkout";

const initialState: CheckoutState = { error: null };

export function CheckoutForm({ cohortId, label }: { cohortId: string; label: string }) {
  const [state, formAction, pending] = useActionState(startPresaleCheckout, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="cohortId" value={cohortId} />
      <button
        type="submit"
        disabled={pending}
        className="h-14 w-full rounded-xs bg-paper px-6 text-base font-medium text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Ouverture du paiement…" : label}
      </button>
      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-paper">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
