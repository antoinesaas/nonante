"use client";

import { useState, useTransition } from "react";
import { validateChallengeDeclaratif } from "@/app/actions/proofs";
import { useI18n } from "@/components/I18nProvider";
import { btnPrimary } from "@/lib/ui";

export function ChallengeDeclaratif({ assignmentId }: { assignmentId: string }) {
  const { m } = useI18n();
  const t = m.app.quest;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm text-mute">{t.declarative}</p>
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
        {pending ? "…" : confirm ? t.confirmDone : t.itsDone}
      </button>
      {message ? (
        <p role="status" className="animate-rise text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
