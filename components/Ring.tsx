/** Anneau de progression fin. Cassé : l'anneau se rompt. */
export function Ring({ progress, broken = false, size = 280 }: { progress: number; broken?: boolean; size?: number }) {
  const stroke = 2;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="max-w-full">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
      {broken ? (
        // Deux morceaux séparés par une brèche.
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-paper)" strokeWidth={stroke}
            strokeDasharray={`${c * Math.max(0, p - 0.04)} ${c}`} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-paper)" strokeWidth={stroke}
            strokeDasharray={`${c * 0.02} ${c}`} strokeDashoffset={-c * (p + 0.02)} />
        </g>
      ) : (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-paper)"
          strokeWidth={stroke}
          strokeDasharray={`${c * p} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}
