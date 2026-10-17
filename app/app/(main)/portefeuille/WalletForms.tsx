"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { addWalletEntry, deleteWalletEntry } from "@/app/actions/wallet";
import { FileField } from "@/components/FileField";
import { useI18n } from "@/components/I18nProvider";
import { Sheet } from "@/components/Sheet";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { compressField } from "@/lib/compress-image";
import { idle } from "@/lib/errors";
import { btnLink, btnPrimary, input, label } from "@/lib/ui";

const SOURCES = ["vente", "client", "freelance", "contenu", "autre"] as const;

/** Bouton blanc « Ajouter un revenu » : le formulaire s'ouvre dans une feuille, l'écran reste léger. */
export function AddWalletEntry({ today, minDay, rule, todayLine }: { today: string; minDay: string; rule: string; todayLine: string | null }) {
  const { m } = useI18n();
  const t = m.app.wallet;
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
          <path d="M8 3 V13 M3 8 H13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {t.add}
      </button>
      {done ? (
        <p role="status" className="mt-3 animate-in rounded-2xl bg-ok/12 px-4 py-3 text-sm text-ok">
          {done}
        </p>
      ) : null}
      <Sheet open={open} onClose={() => setOpen(false)} title={t.add}>
        <p className="text-sm text-mute">{rule}</p>
        {todayLine ? <p className="mt-1 text-sm">{todayLine}</p> : null}
        <div className="mt-5">
          {open ? (
            <WalletEntryForm
              today={today}
              minDay={minDay}
              onDone={(message) => {
                setOpen(false);
                setDone(message);
              }}
            />
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

export function WalletEntryForm({ today, minDay, onDone }: { today: string; minDay: string; onDone?: (message: string | null) => void }) {
  const { m } = useI18n();
  const t = m.app.wallet;
  const [state, formAction] = useActionState(addWalletEntry, idle);
  useEffect(() => {
    if (state.ok) onDone?.(state.message);
  }, [state, onDone]);

  return (
    <form
      action={async (fd) => {
        const data = await compressField(fd, "proof");
        startTransition(() => formAction(data));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>{t.amount}</span>
          <input name="amount" inputMode="decimal" placeholder="450" required className={`${input} mt-2`} />
        </label>
        <label className="block">
          <span className={label}>{t.date}</span>
          <input name="day" type="date" defaultValue={today} min={minDay} max={today} required className={`${input} mt-2`} />
        </label>
      </div>
      <label className="block">
        <span className={label}>{t.source}</span>
        <select name="source" defaultValue="vente" className={`${input} mt-2`}>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {t.sources[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>{t.label}</span>
        <input name="label" placeholder={t.labelPlaceholder} maxLength={80} required className={`${input} mt-2`} />
      </label>
      <FileField name="proof" label={t.proof} placeholder={t.proofPlaceholder} choose={t.choose} hint={t.proofHint} />
      <SubmitButton className={btnPrimary} pendingLabel={m.common.actions.sending}>
        {t.submit}
      </SubmitButton>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}

export function DeleteEntryButton({ id }: { id: string }) {
  const { m } = useI18n();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string | null } | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await deleteWalletEntry(id)))}
        className={`${btnLink} text-xs ${pending ? "opacity-50" : ""}`}
      >
        {m.app.wallet.remove}
      </button>
      {result && !result.ok ? <span className="ml-2 text-xs">{result.message}</span> : null}
    </>
  );
}
