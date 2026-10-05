"use client";

import { useActionState } from "react";
import { type CheckoutState, startStakeCheckout } from "@/app/actions/checkout";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { btnSecondary, label } from "@/lib/ui";

const initial: CheckoutState = { error: null };

/** Mise sur soi (FEATURE_STAKE) : remboursée si l'arc est tenu, reversée à une association sinon. */
export function StakeForm({ amount }: { amount: string }) {
  const [state, action] = useActionState(startStakeCheckout, initial);
  return (
    <section className="mt-14 border-t border-line pt-6">
      <p className={label}>Mise sur soi</p>
      <p className="mt-3 text-sm leading-relaxed text-mute">
        Mise {amount} sur toi. Tu tiens l&apos;arc : remboursement intégral. Tu lâches : reversée à une association. Jamais
        conservée par Nonante, jamais redistribuée aux autres joueurs.
      </p>
      <form action={action} className="mt-4">
        <SubmitButton className={btnSecondary} pendingLabel="Ouverture du paiement…">
          Miser {amount}
        </SubmitButton>
        <FormMessage message={state.error} />
      </form>
    </section>
  );
}
