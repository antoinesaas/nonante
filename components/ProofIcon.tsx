import type { Pillar, ProofType } from "@/lib/types";

// Une couleur par pilier : la pastille de chaque principe, dans les listes comme dans les anneaux.
export const PILLAR_GLOW: Record<Pillar, string> = {
  focus: "from-[#2f7bff] to-[#5ac8fa]",
  corps: "from-[#ff8a1f] to-[#ffc95c]",
  business: "from-[#1fbf7a] to-[#9bf5c9]",
  esprit: "from-[#7b4dff] to-[#d08bff]",
  energie: "from-[#ff2d6f] to-[#ff9bbd]",
};

export const PILLAR_TEXT: Record<Pillar, string> = {
  focus: "text-[#5aa8ff]",
  corps: "text-[#ffb340]",
  business: "text-[#5cf0a6]",
  esprit: "text-[#b28bff]",
  energie: "text-[#ff6b9a]",
};

const PATHS: Record<ProofType, React.ReactNode> = {
  session: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5 V13 L14.5 14.5 M9.5 3 H14.5" />
    </>
  ),
  reps: <path d="M3.5 9.5 V14.5 M6.5 7.5 V16.5 M17.5 7.5 V16.5 M20.5 9.5 V14.5 M6.5 12 H17.5" />,
  reveil: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3 V5 M12 19 V21 M3 12 H5 M19 12 H21 M5.6 5.6 L7 7 M17 17 L18.4 18.4 M5.6 18.4 L7 17 M17 7 L18.4 5.6" />
    </>
  ),
  photo: (
    <>
      <path d="M4 8.5 C4 7.4 4.9 6.5 6 6.5 H8 L9.5 4.5 H14.5 L16 6.5 H18 C19.1 6.5 20 7.4 20 8.5 V17 C20 18.1 19.1 19 18 19 H6 C4.9 19 4 18.1 4 17 Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </>
  ),
  capture: (
    <>
      <rect x="6.5" y="3.5" width="11" height="17" rx="2.5" />
      <path d="M10 6.5 H14 M9.5 17 H14.5" />
    </>
  ),
  lien: (
    <>
      <path d="M10 14 L14 10" />
      <path d="M8.5 11.5 L6.8 13.2 A3.2 3.2 0 0 0 11.3 17.7 L13 16" />
      <path d="M15.5 12.5 L17.2 10.8 A3.2 3.2 0 0 0 12.7 6.3 L11 8" />
    </>
  ),
  declaratif: <path d="M6 12.5 L10 16.5 L18 8" />,
};

/** Pastille ronde en dégradé (couleur du pilier) avec l'icône de la preuve. */
export function ProofIcon({ proof, pillar, muted = false, className = "size-11" }: { proof: ProofType; pillar: Pillar; muted?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full ${muted ? "bg-white/[0.06] text-mute" : `bg-linear-to-br ${PILLAR_GLOW[pillar]} text-black`} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-[55%]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[proof]}
      </svg>
    </span>
  );
}
