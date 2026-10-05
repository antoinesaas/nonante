"use client";

import { useState, useTransition } from "react";
import { proofUrl, reviewAudit } from "@/app/actions/admin";
import { btnSmall } from "@/lib/ui";

export function AuditActions({ auditId, hasAuditPhoto, hasProofPhoto }: { auditId: string; hasAuditPhoto: boolean; hasProofPhoto: boolean }) {
  const [pending, startTransition] = useTransition();
  const [image, setImage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const show = (which: "audit" | "proof") =>
    startTransition(async () => {
      const r = await proofUrl(auditId, which);
      setImage(r.url ?? null);
      setMessage(r.message ?? null);
    });

  const review = (pass: boolean) =>
    startTransition(async () => {
      const r = await reviewAudit(auditId, pass);
      setMessage(r.message);
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {hasAuditPhoto ? (
          <button type="button" disabled={pending} onClick={() => show("audit")} className={btnSmall}>
            Photo du contrôle
          </button>
        ) : null}
        {hasProofPhoto ? (
          <button type="button" disabled={pending} onClick={() => show("proof")} className={btnSmall}>
            Photo d&apos;origine
          </button>
        ) : null}
        <button type="button" disabled={pending} onClick={() => review(true)} className={btnSmall}>
          Accepter
        </button>
        <button type="button" disabled={pending} onClick={() => review(false)} className={btnSmall}>
          Refuser
        </button>
      </div>
      {/* URL signée de 60 s, jamais stockée. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image ? <img src={image} alt="Photo de preuve" className="max-h-96 border border-line" /> : null}
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}
