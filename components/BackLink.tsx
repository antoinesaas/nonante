"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

/** Flèche « retour » en haut à gauche, toujours vers une page connue (fiable, même ouverte depuis une notification). */
export function BackLink({ href = "/app", label }: { href?: string; label?: string }) {
  const { m } = useI18n();
  return (
    <Link
      href={href}
      aria-label={label ?? m.common.actions.back}
      className="-ml-2 grid size-11 place-items-center rounded-full text-mute transition-[color,transform] hover:text-paper active:scale-90"
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
        <path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
