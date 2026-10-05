"use client";

import { useActionState, useState, useTransition } from "react";
import { type MfaEnrollment, mfaEnroll, mfaVerify } from "@/app/actions/admin";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { btnPrimary, btnSecondary, input } from "@/lib/ui";

export function MfaForm({ verifiedFactorId }: { verifiedFactorId: string | null }) {
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, action] = useActionState(mfaVerify, idle);
  const factorId = verifiedFactorId ?? (enrollment && "factorId" in enrollment ? enrollment.factorId : null);

  return (
    <div className="mt-8 space-y-6">
      {!verifiedFactorId && !enrollment ? (
        <button type="button" disabled={pending} onClick={() => startTransition(async () => setEnrollment(await mfaEnroll()))} className={btnSecondary}>
          {pending ? "…" : "Configurer la double authentification"}
        </button>
      ) : null}

      {enrollment && "qr" in enrollment ? (
        <div className="space-y-3">
          {/* QR code SVG fourni par Supabase (data:), affiché sur fond blanc pour être lisible. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qr} alt="QR code de double authentification" className="size-48 bg-paper p-2" />
          <p className="text-xs break-all text-mute">Clé : {enrollment.secret}</p>
        </div>
      ) : null}
      {enrollment && "message" in enrollment ? <p role="alert">{enrollment.message}</p> : null}

      {factorId ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="factorId" value={factorId} />
          <input
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            className={`${input} font-serif text-3xl tracking-[0.3em]`}
          />
          <SubmitButton className={btnPrimary} pendingLabel="Vérification…">
            Vérifier
          </SubmitButton>
          <FormMessage message={state.message} />
        </form>
      ) : null}
    </div>
  );
}
