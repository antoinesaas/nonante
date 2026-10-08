"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { addWalletEntry, deleteWalletEntry } from "@/app/actions/wallet";
import { FileField } from "@/components/FileField";
import { useI18n } from "@/components/I18nProvider";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { compressField } from "@/lib/compress-image";
import { idle } from "@/lib/errors";
import { btnLink, btnPrimary, input, label } from "@/lib/ui";

const SOURCES = ["vente", "client", "freelance", "contenu", "autre"] as const;

export function WalletEntryForm({ today, minDay }: { today: string; minDay: string }) {
  const { m } = useI18n();
  const t = m.app.wallet;
  const [state, formAction] = useActionState(addWalletEntry, idle);

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
