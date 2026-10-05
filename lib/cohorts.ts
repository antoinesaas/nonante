import "server-only";
import type { Database } from "@/lib/database.types";
import { todayParis } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

type CohortRow = Database["public"]["Tables"]["cohorts"]["Row"];

/** Colonnes lisibles par le public (voir la migration : les IDs Stripe sont exclus). */
export const PUBLIC_COHORT_COLUMNS =
  "id, name, start_date, end_date, enroll_open, price_cents, early_price_cents" as const;

export type PublicCohort = Pick<
  CohortRow,
  "id" | "name" | "start_date" | "end_date" | "enroll_open" | "price_cents" | "early_price_cents"
>;

/** Prochain arc ouvert aux inscriptions et pas encore démarré : celui qu'on vend sur la landing. */
export async function getNextOpenCohort(): Promise<PublicCohort | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cohorts")
    .select(PUBLIC_COHORT_COLUMNS)
    .eq("enroll_open", true)
    .eq("is_test", false)
    .gt("start_date", todayParis())
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Lecture des cohortes impossible (${error.code})`);
  return data;
}

/** Nombre réel d'inscrits payés, lu en base. Jamais arrondi ni gonflé. */
export async function getCohortSignups(cohortId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cohort_signups", { p_cohort_id: cohortId });
  if (error) throw new Error(`Lecture des inscrits impossible (${error.code})`);
  return data;
}

/** Prix early bird tant que l'arc n'a pas démarré (date de Paris), prix normal ensuite. */
export function currentPrice(
  cohort: Pick<CohortRow, "start_date" | "price_cents" | "early_price_cents">,
  today: string = todayParis(),
): { early: boolean; cents: number } {
  const early = today < cohort.start_date;
  return { early, cents: early ? cohort.early_price_cents : cohort.price_cents };
}
