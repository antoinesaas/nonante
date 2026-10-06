"use client";

import { useState, useTransition } from "react";
import { regeneratePrinciples } from "@/app/actions/principles";
import { btnLink } from "@/lib/ui";

export function RegenerateButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Remplacer tes principes par ceux proposés pour ton objectif ?")) return;
          startTransition(async () => setMessage((await regeneratePrinciples()).message));
        }}
        className={btnLink}
      >
        Repartir des principes proposés
      </button>
      {message ? <span className="block text-xs text-mute">{message}</span> : null}
    </span>
  );
}
