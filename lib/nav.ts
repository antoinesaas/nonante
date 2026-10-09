import "server-only";
import { getUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";

/** Onglets selon l'arc : Portefeuille pour le business (ou Pro), Notes pour les études. */
export async function navTabs(): Promise<{ wallet: boolean; grades: boolean }> {
  const { supabase, user } = await getUser();
  if (!user) return { wallet: false, grades: false };
  const [{ data: open }, { data: plan }, locale] = await Promise.all([
    supabase.from("enrollments").select("category, locale").eq("user_id", user.id).in("status", ["draft", "active"]).maybeSingle(),
    supabase.rpc("my_plan"),
    getLocale(),
  ]);
  // L'arc suit la langue affichée (choisie ou celle du navigateur) : principes et bibliothèque traduits.
  if (open && open.locale !== locale) await supabase.rpc("set_my_locale", { p_locale: locale });
  const pro = ["pro", "fondateur"].includes((plan as { plan: string | null } | null)?.plan ?? "");
  const category = open?.category;
  return {
    wallet: pro || category === "business" || category === "mixte",
    grades: category === "etudes" || category === "mixte" || (pro && !category),
  };
}
