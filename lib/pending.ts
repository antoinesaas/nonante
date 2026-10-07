import "server-only";
import { z } from "zod";
import { Answers, type ArcAnswers } from "@/lib/answers";
import { validChoice } from "@/lib/checkout";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Interval, PlanId } from "@/lib/types";

// Réponses du questionnaire gardées le temps de la connexion (table pending_arcs, clé : l'email).

/** Cookie qui garde les réponses pendant l'aller-retour chez Google (l'email n'est connu qu'au retour). */
export const PENDING_COOKIE = "nonante_reponses";

const Choice = z.object({
  plan: z.enum(["arc", "pro", "fondateur"]),
  interval: z.enum(["once", "month", "year", "lifetime"]),
});

export function parseAnswers(raw: unknown): ArcAnswers | null {
  try {
    const parsed = Answers.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseChoice(plan: unknown, interval: unknown): { plan: PlanId; interval: Interval } | null {
  const parsed = Choice.safeParse({ plan, interval });
  if (!parsed.success || !validChoice(parsed.data.plan, parsed.data.interval)) return null;
  return parsed.data;
}

export async function savePending(email: string, answers: ArcAnswers, choice: { plan: PlanId; interval: Interval }): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("pending_arcs")
    .upsert({ email, answers, plan: choice.plan, plan_interval: choice.interval, created_at: new Date().toISOString() }, { onConflict: "email" });
  if (error) console.error(`[parcours] réponses non gardées (${error.code})`);
  return !error;
}

/** Retour de Google : range les réponses du cookie avec l'email du compte (appelé par /auth/callback). */
export async function adoptPendingCookie(email: string, raw: string | undefined): Promise<void> {
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { answers?: unknown; plan?: unknown; interval?: unknown };
    const answers = parseAnswers(parsed.answers);
    const choice = parseChoice(parsed.plan, parsed.interval);
    if (answers && choice) await savePending(email.toLowerCase(), answers, choice);
  } catch {
    // Cookie illisible : le questionnaire sera simplement à refaire.
  }
}
