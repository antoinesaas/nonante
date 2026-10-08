"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { btnSmall } from "@/lib/ui";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { m } = useI18n();
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
      {copied ? m.common.actions.copied : (label ?? m.common.actions.copy)}
    </button>
  );
}
