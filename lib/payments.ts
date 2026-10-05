import "server-only";
import type Stripe from "stripe";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import { formatDayFr } from "@/lib/dates";
import { sendWelcome } from "@/lib/emails";
import { createAdminClient } from "@/lib/supabase/admin";

type Cohort = Database["public"]["Tables"]["cohorts"]["Row"];

export function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Pass payé : active l'inscription (idempotent) et envoie l'email de bienvenue une seule fois.
 * Appelé par le webhook ET au retour de Stripe, pour ne pas faire attendre l'utilisateur.
 */
export async function fulfillPass(session: Stripe.Checkout.Session): Promise<{ activated: boolean; userId: string | null }> {
  if (session.payment_status !== "paid" || session.metadata?.type !== "pass") return { activated: false, userId: null };
  const enrollmentId = z.uuid().safeParse(session.metadata.enrollment_id);
  if (!enrollmentId.success) throw new Error("enrollment_id invalide dans les métadonnées");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("activate_paid_enrollment", {
    p_enrollment: enrollmentId.data,
    p_session_id: session.id,
    p_amount: session.amount_total ?? 0,
    p_promotion_code_id: idOf(session.discounts?.find((d) => d.promotion_code)?.promotion_code),
    p_utm_source: session.metadata.utm_source ?? null,
    p_utm_campaign: session.metadata.utm_campaign ?? null,
  });
  if (error) throw new Error(`activation impossible (${error.code})`);
  const result = data as { activated: boolean; user_id: string; cohort_id: string };

  const email = session.customer_details?.email ?? session.customer_email;
  if (email) {
    const { data: first } = await admin.rpc("log_email_once", {
      p_user: result.user_id,
      p_kind: "welcome",
      p_ref: enrollmentId.data,
    });
    if (first) {
      const { data: cohort } = await admin.from("cohorts").select("name, start_date").eq("id", result.cohort_id).single();
      if (cohort) await sendWelcome(email, cohort);
    }
  }
  return { activated: result.activated, userId: result.user_id };
}

export function passDescription(cohort: Pick<Cohort, "start_date" | "end_date">): string {
  return `Du ${formatDayFr(cohort.start_date)} au ${formatDayFr(cohort.end_date)}.`;
}
