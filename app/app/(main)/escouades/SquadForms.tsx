"use client";

import { useActionState, useState, useTransition } from "react";
import { createSquad, joinPublicSquad, joinSquad, leaveSquad } from "@/app/actions/squads";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { btnLink, btnPrimary, btnSmall, input, label } from "@/lib/ui";

export function JoinForm() {
  const [state, formAction] = useActionState(joinSquad, idle);
  return (
    <form action={formAction}>
      <label className="block">
        <span className={label}>Code d&apos;escouade</span>
        <div className="mt-2 flex gap-2">
          <input name="code" maxLength={6} autoCapitalize="characters" placeholder="K7M2QX" className={`${input} uppercase`} />
          <SubmitButton className={`${btnSmall} h-12`} pendingLabel="…">
            Rejoindre
          </SubmitButton>
        </div>
      </label>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}

export function CreateForm() {
  const [state, formAction] = useActionState(createSquad, idle);
  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className={label}>Nom</span>
        <input name="name" maxLength={40} placeholder="Les lève-tôt de Lyon" required className={`${input} mt-2`} />
      </label>
      <label className="block">
        <span className={label}>Description (facultatif)</span>
        <input name="description" maxLength={160} placeholder="Debout avant 6 h, business avant midi." className={`${input} mt-2`} />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="isPublic" className="mt-0.5 size-5 accent-paper" />
        Publique : visible par tous, chacun peut la rejoindre. Sinon, sur code seulement.
      </label>
      <SubmitButton className={btnPrimary} pendingLabel="Création…">
        Créer l&apos;escouade
      </SubmitButton>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}

export function JoinPublicButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end">
      <button type="button" disabled={pending} onClick={() => startTransition(async () => setMessage((await joinPublicSquad(id)).message))} className={btnSmall}>
        Rejoindre
      </button>
      {message ? <span className="mt-1 text-xs">{message}</span> : null}
    </span>
  );
}

export function LeaveButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Quitter cette escouade ?")) startTransition(async () => void (await leaveSquad(id)));
      }}
      className={btnLink}
    >
      Quitter
    </button>
  );
}
