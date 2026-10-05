"use client";

import { useState, useTransition } from "react";
import { validateChallengeDeclaratif } from "@/app/actions/proofs";
import { btnPrimary } from "@/lib/ui";

export function ChallengeDeclaratif({ assignmentId }: { assignmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm text-mute">Preuve déclarative : un contrôle peut tomber, et il faudra alors une capture sous 24 h.</p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm) {
            setConfirm(true);
            return;
          }
          startTransition(async () => setMessage((await validateChallengeDeclaratif(assignmentId)).message));
        }}
        className={btnPrimary}
      >
        {pending ? "…" : confirm ? "Je confirme : c'est fait" : "C'est fait"}
      </button>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
