import type { Category, GoalType, Pillar, ProofType, Target } from "@/lib/types";

export const PROOF_LABEL: Record<ProofType, string> = {
  session: "Minuteur",
  reps: "Caméra",
  reveil: "Code de réveil",
  photo: "Photo",
  capture: "Capture d'écran",
  lien: "Lien",
  declaratif: "Déclaratif",
};

/** Comment on prouve, en une ligne (onglet Principes). */
export const PROOF_HELP: Record<ProofType, string> = {
  session: "Minuteur qui casse si tu quittes l'écran. Preuve forte : 100 % des points.",
  reps: "Pompes ou squats comptés à la caméra, sur ton téléphone. Preuve forte : 100 %.",
  reveil: "Ouvre l'app avant l'heure et recopie un code. Preuve forte : 100 %.",
  photo: "Photo prise dans l'app. Preuve faible : 50 %, contrôles aléatoires.",
  capture: "Capture d'écran (messages, ventes, compteur de pas). Preuve faible : 50 %.",
  lien: "Lien de ta publication. Preuve faible : 50 %.",
  declaratif: "Bouton « Fait ». Preuve faible : 50 %, contrôles aléatoires.",
};

/** Un seul bouton par principe, selon sa preuve. */
export const ACTION_LABEL: Record<ProofType, string> = {
  session: "Lancer",
  reps: "Compter",
  reveil: "Je suis debout",
  photo: "Photo",
  capture: "Capture",
  lien: "Lien",
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
    case "capture":
      return `/app/photo/${principleId}`;
    case "lien":
      return `/app/lien/${principleId}`;
    default:
      return null;
  }
}

export const PILLARS: { value: Pillar; label: string; short: string }[] = [
  { value: "focus", label: "Focus", short: "FOC" },
  { value: "business", label: "Business", short: "BUS" },
  { value: "corps", label: "Corps", short: "COR" },
  { value: "esprit", label: "Esprit", short: "ESP" },
  { value: "energie", label: "Énergie", short: "ÉNE" },
];

export const PILLAR_LABEL: Record<Pillar, string> = {
  focus: "Focus",
  business: "Business",
  corps: "Corps",
  esprit: "Esprit",
  energie: "Énergie",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  etudes: "Études",
  business: "Business",
  mixte: "Les deux",
};

/** Le profil de la cible, posé à l'onboarding. */
export const SITUATIONS: { value: Category; label: string; hint: string }[] = [
  { value: "mixte", label: "Étudiant et entrepreneur", hint: "Les cours le jour, le projet le soir." },
  { value: "business", label: "Entrepreneur", hint: "Ton projet est ton métier, ou va le devenir." },
  { value: "etudes", label: "Étudiant", hint: "Examens, concours, grande école : tout pour réussir." },
];

export const GOAL_TYPES: { value: GoalType; label: string; example: string; unit: string | null }[] = [
  { value: "revenu", label: "Gagner de l'argent", example: "Atteindre 3 000 € par mois avec mon agence", unit: "€" },
  { value: "clients", label: "Signer des clients", example: "Signer mes 10 premiers clients", unit: "clients" },
  { value: "lancement", label: "Lancer mon projet", example: "Lancer mon application et faire la première vente", unit: null },
  { value: "audience", label: "Construire une audience", example: "Passer à 10 000 abonnés sur TikTok", unit: "abonnés" },
  { value: "examens", label: "Réussir mes examens", example: "Valider mon année avec mention", unit: null },
  { value: "corps", label: "Transformer mon corps", example: "Perdre 6 kg et courir 10 km", unit: "kg" },
  { value: "autre", label: "Autre chose", example: "Écrire mon premier livre", unit: null },
];

export const GOAL_LABEL: Record<GoalType, string> = Object.fromEntries(GOAL_TYPES.map((g) => [g.value, g.label])) as Record<GoalType, string>;

export const WEAK_POINTS: { value: string; label: string }[] = [
  { value: "telephone", label: "Je perds des heures sur mon téléphone" },
  { value: "procrastination", label: "Je repousse les tâches importantes" },
  { value: "vente", label: "J'évite de prospecter et de vendre" },
  { value: "dispersion", label: "Je m'éparpille sur trop de choses" },
  { value: "reveil", label: "Je me lève tard ou à des heures différentes" },
  { value: "sport", label: "Je ne fais plus de sport" },
  { value: "regularite", label: "Je commence fort puis je lâche" },
];

export const LINK_DOMAINS = [
  "tiktok.com", "instagram.com", "youtube.com", "linkedin.com", "x.com", "twitter.com", "threads.net", "facebook.com",
  "github.com", "medium.com", "substack.com", "producthunt.com", "behance.net", "dribbble.com", "twitch.tv",
  "spotify.com", "pinterest.com", "reddit.com",
];

const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
export const DAY_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

/** {1..7} → « tous les jours », « samedi et dimanche », « du lundi au vendredi »… */
export function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "tous les jours";
  if (sorted.join() === "1,2,3,4,5") return "du lundi au vendredi";
  if (sorted.join() === "6,7") return "le week-end";
  const names = sorted.map((d) => DAY_NAMES[d - 1]);
  if (names.length === 1) return `le ${names[0]}`;
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

/** « 07:00 » → « 7 h », « 06:30 » → « 6 h 30 ». */
export function timeFr(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
}

/** Précision affichée sous un principe : « 50 min · avant 12 h », « 20 pompes »… */
export function targetHint(proof: ProofType, target: Target): string | null {
  const parts: string[] = [];
  if (proof === "session" && target.minutes) parts.push(`${target.minutes} min`);
  if (proof === "reps" && target.reps) parts.push(`${target.reps} ${target.exercise === "squat" ? "squats" : "pompes"}`);
  if (target.before) parts.push(proof === "reveil" ? `avant ${timeFr(target.before)}` : `fini avant ${timeFr(target.before)}`);
  if (target.after) parts.push(`à partir de ${timeFr(target.after)}`);
  if (target.count) parts.push(`${target.count.toLocaleString("fr-FR")}${target.unit ? ` ${target.unit}` : ""}`);
  return parts.length ? parts.join(" · ") : null;
}

/** Total de points : vrai signe moins (−30), sans « + » devant les positifs. */
export function points(n: number): string {
  return n < 0 ? `−${Math.abs(n).toLocaleString("fr-FR")}` : n.toLocaleString("fr-FR");
}

export function signed(points: number): string {
  return points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : "0";
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("fr-FR")} ${Math.abs(n) > 1 ? many : one}`;
}

/** « alors 20 pompes. » → « 20 pompes » */
export function bareThen(text: string): string {
  return text.replace(/^alors /, "").replace(/\.$/, "");
}
