"use client";

import { useActionState, useId } from "react";
import { joinWaitlist, type WaitlistState } from "@/app/actions/waitlist";

const initialState: WaitlistState = { status: "idle", message: null };

export function WaitlistForm({ cohortId, cta }: { cohortId: string | null; cta: string }) {
  const [state, formAction, pending] = useActionState(joinWaitlist, initialState);
  const emailId = useId();

  if (state.status === "ok") {
    return (
      <p role="status" className="text-paper">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="relative">
      {cohortId ? <input type="hidden" name="cohortId" value={cohortId} /> : null}

      {/* Champ piège pour les robots, invisible pour les humains. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label htmlFor={emailId} className="sr-only">
        Ton email
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={emailId}
          name="email"
          type="email"
          required
          maxLength={254}
          defaultValue={state.email ?? ""}
          autoComplete="email"
          inputMode="email"
          placeholder="ton@email.fr"
          className="h-12 min-w-0 flex-1 rounded-xs border border-line bg-surface px-4 text-base text-paper placeholder:text-mute focus:border-paper focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-xs border border-paper px-5 text-base text-paper transition-colors hover:bg-paper hover:text-ink disabled:opacity-60"
        >
          {pending ? "Envoi…" : cta}
        </button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="mt-3 text-sm text-paper">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
