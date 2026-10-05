"use client";

import { useState } from "react";
import { btnSmall } from "@/lib/ui";

export function CopyButton({ value, label = "Copier" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      className={btnSmall}
    >
      {copied ? "Copié" : label}
    </button>
  );
}
