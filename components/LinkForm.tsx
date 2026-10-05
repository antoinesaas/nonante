"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type ProofResult, validateChallengeLink, validateLink } from "@/app/actions/proofs";
import { SubmitButton } from "@/components/SubmitButton";
import { btnLink, btnPrimary, input } from "@/lib/ui";

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
  const [state, action] = useActionState(mode === "principle" ? validateLink : validateChallengeLink, initial);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <p className="font-serif text-4xl">Validé.</p>
        <p className="text-mute">{state.message}</p>
        <Link href="/app" className={btnPrimary}>
          Retour
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name={mode === "principle" ? "principleId" : "assignmentId"} value={targetId} />
      <label className="block">
        <span className="text-sm text-mute">Lien de ta publication</span>
        <input name="url" type="url" required inputMode="url" placeholder="https://" className={`${input} mt-2`} />
      </label>
      {domains.length ? <p className="text-xs text-mute">Accepté : {domains.join(", ")}. Un lien ne sert qu&apos;une fois.</p> : null}
      <SubmitButton className={btnPrimary} pendingLabel="Vérification…">
        Valider
      </SubmitButton>
      {state.message ? (
        <p role="alert" className="text-sm">
          {state.message}
        </p>
      ) : null}
      <Link href="/app" className={btnLink}>
        Retour
      </Link>
    </form>
  );
}
