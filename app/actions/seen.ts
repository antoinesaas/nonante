"use server";

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

// Marqués « vus » au clic sur Continuer, jamais au rendu (le préchargement de Next rend les pages en avance).
export async function markAchievementsSeen(): Promise<void> {
  const { supabase, user } = await getUser();
  if (user) await supabase.rpc("mark_achievements_seen");
  redirect("/app");
}

export async function markLevelSeen(): Promise<void> {
  const { supabase, user } = await getUser();
  if (user) await supabase.rpc("mark_level_seen");
  redirect("/app");
}
