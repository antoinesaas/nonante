"use client";

import { useActionState, useState, useTransition } from "react";
import { placeJoker } from "@/app/actions/proofs";
import { setStartDate } from "@/app/actions/principles";
import { useI18n } from "@/components/I18nProvider";
import { Sheet } from "@/components/Sheet";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { fmt } from "@/lib/i18n/format";
import { btnLink, btnPrimary, btnSecondary } from "@/lib/ui";

/** Joker : la journée ne compte pas, la série continue. Confirmation avant de le poser. */
export function JokerButton({ left }: { left: number }) {
  const { m } = useI18n();
  const t = m.app.today;
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button type="button" disabled={pending} onClick={() => setOpen(true)} className={btnLink}>
        {fmt(t.jokerButton, { n: left })}
      </button>
      {message ? (
        <p role="status" className="mt-2 animate-rise text-sm">
          {message}
        </p>
      ) : null}
      <Sheet open={open} onClose={() => setOpen(false)} title={t.jokerTitle}>
        <p className="mt-2 text-sm text-mute">{fmt(t.jokerText, { n: left })}</p>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setMessage((await placeJoker()).message);
                setOpen(false);
              })
            }
            className={btnPrimary}
          >
            {pending ? "…" : t.jokerConfirm}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={`${btnSecondary} w-full`}>
            {m.common.actions.cancel}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

/** Avant le jour 1 : commencer tout de suite. */
export function StartTodayButton({ today }: { today: string }) {
  const { m } = useI18n();
  const [state, formAction] = useActionState(setStartDate, idle);
  return (
    <form action={formAction}>
      <input type="hidden" name="date" value={today} />
      <SubmitButton className={btnPrimary} pendingLabel="…">
        {m.app.today.startToday}
      </SubmitButton>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}
