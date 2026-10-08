import "server-only";
import { getUser } from "@/lib/auth";

/** Onglets selon l'arc : Portefeuille pour le business (ou Pro), Notes pour les études. */
export async function navTabs(): Promise<{ wallet: boolean; grades: boolean }> {
  const { supabase, user } = await getUser();
  if (!user) return { wallet: false, grades: false };
  const [{ data: open }, { data: plan }] = await Promise.all([
    supabase.from("enrollments").select("category").eq("user_id", user.id).in("status", ["draft", "active"]).maybeSingle(),
    supabase.rpc("my_plan"),
  ]);
  const pro = ["pro", "fondateur"].includes((plan as { plan: string | null } | null)?.plan ?? "");
  const category = open?.category;
  return {
    wallet: pro || category === "business" || category === "mixte",
    grades: category === "etudes" || category === "mixte" || (pro && !category),
  };
}
