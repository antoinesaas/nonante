"use client";

import { useEffect, useRef, useState } from "react";
import { label as labelClass } from "@/lib/ui";

/** Champ de fichier (capture, photo) : une zone pointillée qui affiche le nom choisi. */
export function FileField({ name, label, placeholder, choose, hint }: { name: string; label: string; placeholder: string; choose: string; hint?: string }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  // Formulaire remis à zéro après l'envoi (React 19) : on efface aussi le nom affiché.
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const clear = () => setFileName(null);
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <span
        className={`mt-2 flex h-12 cursor-pointer items-center justify-between gap-3 rounded-xs border border-dashed px-4 text-sm transition-colors hover:border-mute ${fileName ? "border-paper text-paper" : "border-line text-mute"}`}
      >
        <span className="truncate">{fileName ?? placeholder}</span>
        <span className="shrink-0 text-paper">{choose}</span>
      </span>
      <input
        ref={ref}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
      {hint ? <span className="mt-2 block text-xs text-mute">{hint}</span> : null}
    </label>
  );
}
