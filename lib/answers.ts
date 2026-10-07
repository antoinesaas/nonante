import { z } from "zod";
import { todayParis } from "@/lib/dates";

// Réponses du questionnaire : vérifiées ici (navigateur et serveur), puis par Postgres (save_arc).

export const COMMITMENTS = [
  { value: "essayer", label: "Je veux essayer", echo: "Tu as dit vouloir essayer. Le meilleur moyen, c'est d'aller au bout." },
  { value: "decide", label: "Je suis décidé", echo: "Tu as dit être décidé. Voilà de quoi le prouver, chaque jour." },
  { value: "tout", label: "Je suis prêt à tout donner", echo: "Tu as dit être prêt à tout donner. Ton arc va te prendre au mot." },
] as const;

export const Answers = z.object({
  category: z.enum(["etudes", "business", "mixte"], { error: "Choisis ton profil." }),
  goalType: z.enum(["revenu", "clients", "lancement", "audience", "examens", "corps", "autre"], { error: "Choisis ton objectif." }),
  goal: z.string().trim().min(3, { error: "Ton objectif : au moins 3 caractères." }).max(120),
  goalTarget: z.number().positive().max(999_999_999).nullable(),
  goalUnit: z.string().trim().max(20).nullable(),
  goalPublic: z.boolean(),
  weakPoints: z.array(z.enum(["telephone", "procrastination", "reveil", "sport", "dispersion", "vente", "regularite"])).max(7),
  wakeTime: z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, { error: "Heure de lever invalide." }),
  pushups: z.enum(["oui", "quelques", "non"], { error: "Réponds à la question sur les pompes." }),
  focusMinutes: z.union([z.literal(25), z.literal(50), z.literal(90)]),
  start: z.string().regex(/^(today|tomorrow|monday|date:\d{4}-\d{2}-\d{2}|squad:[0-9a-f-]{36})$/, { error: "Choisis ton jour 1." }),
  commitment: z.enum(["essayer", "decide", "tout"]).nullable(),
  pseudo: z.string().max(20).nullable(),
  isPublic: z.boolean(),
});

export type ArcAnswers = z.infer<typeof Answers>;

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nextMonday(today: string): string {
  const isodow = ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
  return addDays(today, 8 - isodow);
}

/** Jour 1 d'après le choix (« today », « monday »…), en heure de Paris. Départ collectif : date fournie à part. */
export function startDateOf(choice: string, today = todayParis(), squadDate?: string | null): { date: string; squadId: string | null } {
  if (choice === "tomorrow") return { date: addDays(today, 1), squadId: null };
  if (choice === "monday") return { date: nextMonday(today), squadId: null };
  if (choice.startsWith("date:")) return { date: choice.slice(5), squadId: null };
  if (choice.startsWith("squad:")) return { date: squadDate ?? today, squadId: choice.slice(6) };
  return { date: today, squadId: null };
}
