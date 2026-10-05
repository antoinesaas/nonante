"use client";

import { useState, useTransition } from "react";
import { resolveReport } from "@/app/actions/admin";
import { btnSmall } from "@/lib/ui";

export function ReportActions({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const act = (status: "dismissed" | "actioned", hide: boolean) =>
    startTransition(async () => setMessage((await resolveReport(reportId, status, hide)).message));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => act("dismissed", false)} className={btnSmall}>
        Classer sans suite
      </button>
      <button type="button" disabled={pending} onClick={() => act("actioned", true)} className={btnSmall}>
        Masquer le profil
      </button>
      {message ? <span className="text-sm text-mute">{message}</span> : null}
    </div>
  );
}
