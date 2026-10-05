"use client";

import { useState, useTransition } from "react";
import { markStakeDonated } from "@/app/actions/admin";
import { btnSmall } from "@/lib/ui";

export function StakeDonated({ enrollmentId }: { enrollmentId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  if (done) return <span className="text-mute">{done}</span>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => setDone((await markStakeDonated(enrollmentId)).message))}
      className={btnSmall}
    >
      Marquer reversée
    </button>
  );
}
