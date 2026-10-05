import { daysLabel, isStrong, PROOF_LABEL } from "@/lib/proofs";
import type { ProofType } from "@/lib/types";

export type PrincipleRow = {
  id: string;
  if_text: string;
  then_text: string;
  proof_type: string;
  difficulty: number;
  max_difficulty: number;
  days: number[];
  source: string;
};

/** Liste des principes : « si… » en gris, « alors… » en blanc, preuve, jours et valeur. */
export function PrincipleList({ principles }: { principles: PrincipleRow[] }) {
  return (
    <ol className="divide-y divide-line border-y border-line">
      {principles.map((p) => {
        const proof = p.proof_type as ProofType;
        return (
          <li key={p.id} className="py-5">
            <p className="text-mute">{p.if_text},</p>
            <p className="mt-1 text-lg leading-snug">{p.then_text}</p>
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-mute">
              <span>{PROOF_LABEL[proof]}</span>
              <span>preuve {isStrong(proof) ? "forte" : "faible"}</span>
              <span>{daysLabel(p.days)}</span>
              <span>difficulté {p.difficulty}</span>
              <span className="text-paper">{10 * p.difficulty} pts</span>
              {p.max_difficulty > p.difficulty ? <span>{10 * p.max_difficulty} pts au niveau 2</span> : null}
              {p.source === "custom" ? <span>principe perso</span> : null}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
