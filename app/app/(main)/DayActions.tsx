"use client";

import { useActionState, useState, useTransition } from "react";
import { placeJoker } from "@/app/actions/proofs";
import { setStartDate } from "@/app/actions/principles";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { btnLink, btnPrimary } from "@/lib/ui";

/** Joker : la journée ne compte pas, la série continue. Confirmation avant de le poser. */
export function JokerButton({ left }: { left: number }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Poser un joker ? Aujourd'hui ne comptera pas : ni points, ni pénalité. Il t'en reste ${left}.`)) return;
          startTransition(async () => setMessage((await placeJoker()).message));
        }}
        className={btnLink}
      >
        Poser un joker ({left})
      </button>
      {message ? (
        <p role="status" className="mt-2 text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Avant le jour 1 : commencer tout de suite. */
export function StartTodayButton({ today }: { today: string }) {
  const [state, formAction] = useActionState(setStartDate, idle);
  return (
    <form action={formAction}>
      <input type="hidden" name="date" value={today} />
      <SubmitButton className={btnPrimary} pendingLabel="…">
        Commencer aujourd&apos;hui
      </SubmitButton>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}
