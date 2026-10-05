/** Le symbole : un quart de cercle (90°) terminé par un point. */
export function ArcMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <path d="M6 6A20 20 0 0 1 26 26" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="26" cy="26" r="3" fill="currentColor" />
    </svg>
  );
}

export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const mark = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const word = size === "sm" ? "text-[1.35rem]" : "text-[1.7rem]";
  return (
    <span className="inline-flex items-end gap-2 text-paper">
      <ArcMark className={mark} />
      <span className={`font-serif leading-[0.8] tracking-tight ${word}`}>nonante</span>
    </span>
  );
}
