"use server";

import { z } from "zod";
import { getUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const Feedback = z.object({
  place: z.enum(["resultat", "suite"]),
  reason: z.enum(["prix", "moment", "doute", "essai", "confiance", "autre"]),
  message: z.string().max(500),
});

/** « Pourquoi tu pars ? » : raison et message d'un visiteur qui fait demi-tour avant de payer (table exit_feedback). */
export async function sendExitFeedback(place: string, reason: string, message: string): Promise<{ ok: boolean }> {
  const parsed = Feedback.safeParse({ place, reason, message });
  if (!parsed.success) return { ok: false };
  if (!(await rateLimit("exit-feedback", 5, 3600))) return { ok: false };
  const [{ user }, { locale }] = await Promise.all([getUser(), getI18n()]);
  const { error } = await createAdminClient().rpc("save_exit_feedback", {
    p_place: parsed.data.place,
    p_reason: parsed.data.reason,
    p_message: parsed.data.message,
    p_user: user?.id ?? null,
    p_locale: locale,
  });
  if (error) console.error(`[feedback] erreur base : ${error.code}`);
  return { ok: !error };
}
