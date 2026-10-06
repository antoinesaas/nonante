"use client";

import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import { addWalletEntry, deleteWalletEntry } from "@/app/actions/wallet";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { compressField } from "@/lib/compress-image";
import { idle } from "@/lib/errors";
import { btnLink, btnPrimary, input, label } from "@/lib/ui";

const SOURCES = [
  { value: "vente", label: "Vente" },
  { value: "client", label: "Client" },
  { value: "freelance", label: "Mission freelance" },
  { value: "contenu", label: "Contenu" },
  { value: "autre", label: "Autre" },
];

export function WalletEntryForm({ today, minDay }: { today: string; minDay: string }) {
  const [state, formAction] = useActionState(addWalletEntry, idle);
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        const data = await compressField(fd, "proof");
        setFileName(null);
        startTransition(() => formAction(data));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={label}>Montant (€)</span>
          <input name="amount" inputMode="decimal" placeholder="450" required className={`${input} mt-2`} />
        </label>
        <label className="block">
          <span className={label}>Date</span>
          <input name="day" type="date" defaultValue={today} min={minDay} max={today} required className={`${input} mt-2`} />
        </label>
      </div>
      <label className="block">
        <span className={label}>Source</span>
        <select name="source" defaultValue="vente" className={`${input} mt-2`}>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>Libellé</span>
        <input name="label" placeholder="Site vitrine pour un restaurant" maxLength={80} required className={`${input} mt-2`} />
      </label>
      <label className="block">
        <span className={label}>Preuve (capture d&apos;écran)</span>
        <span className="mt-2 flex h-12 cursor-pointer items-center justify-between rounded-xs border border-dashed border-line px-4 text-sm text-mute hover:border-mute">
          <span className="truncate">{fileName ?? "Virement, Stripe, facture payée…"}</span>
          <span className="text-paper">Choisir</span>
        </span>
        <input
          name="proof"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        <span className="mt-2 block text-xs text-mute">
          Sans capture, le revenu est noté mais pas prouvé : il ne compte ni pour tes stats ni pour tes succès. Les captures
          restent privées, supprimées après 30 jours.
        </span>
      </label>
      <SubmitButton className={btnPrimary} pendingLabel="Envoi…">
        Ajouter au portefeuille
      </SubmitButton>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}

export function DeleteEntryButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setMessage((await deleteWalletEntry(id)).message))}
        className={`${btnLink} text-xs`}
      >
        retirer
      </button>
      {message && message !== "Retiré." ? <span className="ml-2 text-xs">{message}</span> : null}
    </>
  );
}
