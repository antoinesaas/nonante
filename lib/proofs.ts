import type { Category, ProofType } from "@/lib/types";

export const PROOF_LABEL: Record<ProofType, string> = {
  session: "Minuteur",
  reps: "Caméra",
  reveil: "Code de réveil",
  photo: "Photo",
  lien: "Lien",
  declaratif: "Déclaratif",
};

/** Un seul bouton par principe, selon sa preuve (§10). */
export const ACTION_LABEL: Record<ProofType, string> = {
  session: "Lancer",
  reps: "Compter",
  reveil: "Je suis debout",
  photo: "Prendre la photo",
  lien: "Coller le lien",
  declaratif: "Fait",
};

export const STRONG_PROOFS: ProofType[] = ["session", "reps", "reveil"];

export function isStrong(proof: ProofType): boolean {
  return STRONG_PROOFS.includes(proof);
}

/** Page de preuve d'un principe (null : validation directe depuis le tableau de bord). */
export function proofHref(proof: ProofType, principleId: string): string | null {
  switch (proof) {
    case "session":
      return `/app/session/${principleId}`;
    case "reps":
      return `/app/reps/${principleId}`;
    case "reveil":
      return `/app/reveil/${principleId}`;
    case "photo":
      return `/app/photo/${principleId}`;
    case "lien":
      return `/app/lien/${principleId}`;
    default:
      return null;
  }
}

export const CATEGORY_LABEL: Record<Category, string> = {
  etudes: "Études",
  business: "Business",
  mixte: "Les deux",
};

export const WEAK_MOMENTS: { value: string; label: string }[] = [
  { value: "soir", label: "Le soir, sur le téléphone" },
  { value: "weekend", label: "Le week-end" },
  { value: "fatigue", label: "Quand je suis fatigué" },
  { value: "commencer", label: "Quand je ne sais pas par où commencer" },
  { value: "personne", label: "Quand personne ne me regarde" },
];

const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** {1..7} → « tous les jours », « samedi et dimanche », « du lundi au vendredi »… */
export function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "tous les jours";
  if (sorted.join() === "1,2,3,4,5") return "du lundi au vendredi";
  const names = sorted.map((d) => DAY_NAMES[d - 1]);
  if (names.length === 1) return `le ${names[0]}`;
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

/** « 07:00 » → « 7 h », « 06:30 » → « 6 h 30 ». */
export function timeFr(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
}

export function signed(points: number): string {
  return points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : "0";
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("fr-FR")} ${Math.abs(n) > 1 ? many : one}`;
}
