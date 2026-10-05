"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { isDisposableEmail } from "@/lib/disposable-email";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUtm, UTM_COOKIE } from "@/lib/utm";

/** `email` renvoie la saisie en cas d'erreur, pour ne pas vider le champ. */
export type WaitlistState = { status: "idle" | "ok" | "error"; message: string | null; email?: string };

const Input = z.object({
  email: z.email({ error: "Adresse email invalide." }).max(254, { error: "Adresse email trop longue." }),
  cohortId: z.uuid().nullable(),
  // Champ piège invisible : un humain le laisse vide.
  website: z.string().max(0).nullable(),
});

const OK: WaitlistState = {
  status: "ok",
  message: "C'est noté. Tu recevras un email avant le départ.",
};

export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const cohortId = formData.get("cohortId");
  const typed = String(formData.get("email") ?? "").slice(0, 254);
  const fail = (message: string): WaitlistState => ({ status: "error", message, email: typed });

  const parsed = Input.safeParse({
    email: typed.trim().toLowerCase(),
    cohortId: cohortId ? String(cohortId) : null,
    website: formData.get("website") ? String(formData.get("website")) : null,
  });

  if (!parsed.success) {
    const honeypot = parsed.error.issues.some((issue) => issue.path[0] === "website");
    // Robot : on fait comme si tout allait bien.
    if (honeypot) return OK;
    return fail(parsed.error.issues[0]?.message ?? "Requête invalide.");
  }

  const { email, cohortId: parsedCohortId } = parsed.data;
  if (isDisposableEmail(email)) {
    return fail("Les adresses jetables ne sont pas acceptées.");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail("La liste d'attente n'est pas encore disponible.");
  }

  if (!(await rateLimit("waitlist", 5, 3600))) {
    return fail("Trop de tentatives. Réessaie dans une heure.");
  }

  const utm = parseUtm((await cookies()).get(UTM_COOKIE)?.value);
  const { error } = await createAdminClient()
    .from("waitlist")
    .upsert(
      { email, cohort_id: parsedCohortId, utm_source: utm.source, utm_campaign: utm.campaign },
      { onConflict: "email,cohort_id", ignoreDuplicates: true },
    );

  if (error) {
    // 23503 : cohorte inconnue.
    console.error(`[waitlist] insertion impossible : ${error.code}`);
    return fail("Inscription impossible pour le moment. Réessaie dans un instant.");
  }

  // Même réponse que l'email soit nouveau ou déjà inscrit : pas d'énumération possible.
  return OK;
}
