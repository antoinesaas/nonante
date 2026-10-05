"use client";

import { useActionState } from "react";
import { type CheckoutState, startPassCheckout } from "@/app/actions/checkout";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { btnPrimary } from "@/lib/ui";

const initial: CheckoutState = { error: null };

export function CheckoutPassForm({ label }: { label: string }) {
  const [state, action] = useActionState(startPassCheckout, initial);
  return (
    <form action={action}>
      <SubmitButton className={btnPrimary} pendingLabel="Ouverture du paiement…">
        {label}
      </SubmitButton>
      <FormMessage message={state.error} />
      <p className="mt-3 text-xs text-mute">Paiement sécurisé par Stripe.</p>
    </form>
  );
}
