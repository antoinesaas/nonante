"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type ProofResult, validateChallengeLink, validateLink } from "@/app/actions/proofs";
import { useI18n } from "@/components/I18nProvider";
import { SubmitButton } from "@/components/SubmitButton";
import { fmt } from "@/lib/i18n/format";
import { btnPrimary, input } from "@/lib/ui";

const initial: ProofResult = { ok: false, message: null };

/** Lien de publication : le serveur vérifie le format et le domaine, sans jamais l'ouvrir. */
export function LinkForm({
  mode,
  targetId,
  domains,
}: {
  mode: "principle" | "challenge";
  targetId: string;
  domains: string[];
}) {
  const { m } = useI18n();
  const t = m.app.proofs;
  const [state, action] = useActionState(mode === "principle" ? validateLink : validateChallengeLink, initial);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <p className="font-serif text-4xl">{t.validated}</p>
        <p className="text-mute">{state.message}</p>
        <Link href="/app" replace className={btnPrimary}>
          {m.app.timer.finish}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name={mode === "principle" ? "principleId" : "assignmentId"} value={targetId} />
      <label className="block">
        <span className="text-sm text-mute">{t.linkLabel}</span>
        <input name="url" type="url" required inputMode="url" placeholder="https://" className={`${input} mt-2`} />
      </label>
      {domains.length ? <p className="text-xs text-mute">{fmt(t.linkAccepted, { domains: domains.join(", ") })}</p> : null}
      <SubmitButton className={btnPrimary} pendingLabel={t.checking}>
        {t.validate}
      </SubmitButton>
      {state.message ? (
        <p role="alert" className="text-sm">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
