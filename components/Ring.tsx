/** Anneau du minuteur : piste teintée, trait en dégradé rose, extrémité arrondie. Cassé : l'anneau rougit et se rompt. */
export function Ring({ progress, broken = false, size = 280 }: { progress: number; broken?: boolean; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  const mid = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="max-w-full">
      <defs>
        <linearGradient id="timer-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff2d6f" />
          <stop offset="100%" stopColor="#ff9bc4" />
        </linearGradient>
      </defs>
      <circle cx={mid} cy={mid} r={r} fill="none" stroke={broken ? "#ff453a" : "#ff2d6f"} strokeOpacity={0.16} strokeWidth={stroke} />
      {broken ? (
        <g transform={`rotate(-90 ${mid} ${mid})`}>
          <circle cx={mid} cy={mid} r={r} fill="none" stroke="#ff453a" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * Math.max(0, p - 0.05)} ${c}`} />
          <circle cx={mid} cy={mid} r={r} fill="none" stroke="#ff453a" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * 0.01} ${c}`} strokeDashoffset={-c * (p + 0.03)} />
        </g>
      ) : p > 0 ? (
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke="url(#timer-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(c * p, 0.1)} ${c}`}
          transform={`rotate(-90 ${mid} ${mid})`}
          className="transition-[stroke-dasharray] duration-500 ease-linear"
        />
      ) : null}
    </svg>
  );
}
