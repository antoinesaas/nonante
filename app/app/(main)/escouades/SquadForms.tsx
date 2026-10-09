"use client";

import { useActionState, useState, useTransition } from "react";
import { createSquad, joinPublicSquad, joinSquad, leaveSquad } from "@/app/actions/squads";
import { useI18n } from "@/components/I18nProvider";
import { Sheet } from "@/components/Sheet";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { btnLink, btnPrimary, btnSecondary, btnSmall, input, label } from "@/lib/ui";

export function JoinForm() {
  const { m } = useI18n();
  const t = m.app.squads;
  const [state, formAction] = useActionState(joinSquad, idle);
  return (
    <form action={formAction}>
      <label className="block">
        <span className={label}>{t.joinCode}</span>
        <div className="mt-2 flex gap-2">
          <input name="code" maxLength={6} autoCapitalize="characters" placeholder="K7M2QX" className={`${input} uppercase`} />
          <SubmitButton className={`${btnSmall} h-12`} pendingLabel="…">
            {t.join}
          </SubmitButton>
        </div>
      </label>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}

export function CreateForm({ today, maxDay }: { today: string; maxDay: string }) {
  const { m } = useI18n();
  const t = m.app.squads;
  const [state, formAction] = useActionState(createSquad, idle);
  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className={label}>{t.name}</span>
        <input name="name" maxLength={40} placeholder={t.namePlaceholder} required className={`${input} mt-2`} />
      </label>
      <label className="block">
        <span className={label}>{t.description}</span>
        <input name="description" maxLength={160} placeholder={t.descriptionPlaceholder} className={`${input} mt-2`} />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="isPublic" className="mt-0.5 size-5 accent-paper" />
        {t.publicCheck}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block min-w-0">
          <span className={label}>{t.startLabel}</span>
          <input name="startDate" type="date" min={today} max={maxDay} className={`${input} mt-2`} />
        </label>
        <label className="block min-w-0">
          <span className={label}>{t.categoryLabel}</span>
          <select name="category" defaultValue="" className={`${input} mt-2`}>
            <option value="">{t.categoryAny}</option>
            <option value="etudes">{m.game.category.etudes}</option>
            <option value="business">{m.game.category.business}</option>
            <option value="mixte">{m.game.category.mixte}</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-mute">{t.startHint}</p>
      <SubmitButton className={btnPrimary} pendingLabel={t.creating}>
        {t.createButton}
      </SubmitButton>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}

export function JoinPublicButton({ id }: { id: string }) {
  const { m } = useI18n();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end">
      <button type="button" disabled={pending} onClick={() => startTransition(async () => setMessage((await joinPublicSquad(id)).message))} className={btnSmall}>
        {pending ? "…" : m.app.squads.join}
      </button>
      {message ? <span className="mt-1 text-xs">{message}</span> : null}
    </span>
  );
}

export function LeaveButton({ id }: { id: string }) {
  const { m } = useI18n();
  const t = m.app.squads;
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" disabled={pending} onClick={() => setOpen(true)} className={btnLink}>
        {pending ? "…" : t.leave}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.leaveTitle}>
        <p className="mt-2 text-sm text-mute">{t.leaveText}</p>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              startTransition(async () => void (await leaveSquad(id)));
            }}
            className={btnPrimary}
          >
            {t.leave}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={`${btnSecondary} w-full`}>
            {m.common.actions.cancel}
          </button>
        </div>
      </Sheet>
    </>
  );
}
