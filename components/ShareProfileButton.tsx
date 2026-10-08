"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { btnSecondary } from "@/lib/ui";

/**
 * Partage du profil public avec le lien de parrainage : feuille de partage du téléphone (WhatsApp, Instagram, SMS…),
 * sinon le texte et le lien sont copiés.
 */
export function ShareProfileButton({ url, code, className = "" }: { url: string; code: string; className?: string }) {
  const { m } = useI18n();
  const t = m.common.share;
  const [copied, setCopied] = useState(false);
  const text = fmt(t.text, { code });

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Nonante", text, url });
        return;
      } catch (error) {
        // Feuille fermée par l'utilisateur : rien à faire. Autre refus (navigateur intégré) : on copie.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={share} className={`${btnSecondary} w-full gap-2 ${className}`}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5 V14.5" />
        <path d="M8.25 7.25 L12 3.5 L15.75 7.25" />
        <path d="M8.5 10.5 H6.75 C6.06 10.5 5.5 11.06 5.5 11.75 V19 C5.5 19.69 6.06 20.25 6.75 20.25 H17.25 C17.94 20.25 18.5 19.69 18.5 19 V11.75 C18.5 11.06 17.94 10.5 17.25 10.5 H15.5" />
      </svg>
      <span aria-live="polite">{copied ? t.copied : t.profile}</span>
    </button>
  );
}
