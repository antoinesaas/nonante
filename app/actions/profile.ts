"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { type ActionResult, userMessage } from "@/lib/errors";
import { removeProofPhotos } from "@/lib/photos";
import { isAllowedPushEndpoint } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  const art = formData.get("art");
  const { error } = await supabase.rpc("update_profile_settings", {
    p_is_public: formData.get("isPublic") === "on",
    p_art_slug: typeof art === "string" && /^[a-z0-9-]{1,60}$/.test(art) ? art : null,
    p_email_reminders: formData.get("emailReminders") === "on",
  });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/app/profil");
  return { ok: true, message: "Enregistré." };
}

const Subscription = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function savePushSubscription(subscription: unknown): Promise<ActionResult> {
  const parsed = Subscription.safeParse(subscription);
  if (!parsed.success || !isAllowedPushEndpoint(parsed.data.endpoint)) return { ok: false, message: "Abonnement invalide." };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  if (!(await rateLimit("push", 10, 3600))) return { ok: false, message: "Trop de tentatives." };
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
  });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/app/profil");
  return { ok: true, message: "Notifications activées." };
}

export async function disablePush(): Promise<ActionResult> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  await supabase.rpc("delete_push_subscriptions");
  revalidatePath("/app/profil");
  return { ok: true, message: "Notifications désactivées." };
}

export async function reportUser(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi pour signaler un profil." };
  if (!(await rateLimit("report", 10, 86400))) return { ok: false, message: "Trop de signalements aujourd'hui." };
  const { error } = await supabase.rpc("report_user", {
    p_pseudo: String(formData.get("pseudo") ?? "").slice(0, 40),
    p_reason: String(formData.get("reason") ?? "").slice(0, 500),
  });
  if (error) return { ok: false, message: userMessage(error) };
  return { ok: true, message: "Signalement envoyé. Merci." };
}

/** Suppression de compte (RGPD) : données de jeu, photos, puis compte d'authentification. */
export async function deleteAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  const { data: profile } = await supabase.from("profiles").select("pseudo").eq("id", user.id).maybeSingle();
  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (profile && typed !== profile.pseudo) return { ok: false, message: "Recopie ton pseudo pour confirmer." };

  const { data: paths, error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, message: userMessage(error) };
  await removeProofPhotos((paths as string[] | null) ?? []);
  const { error: authError } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (authError) console.error(`[compte] suppression auth impossible : ${authError.code ?? "erreur"}`);
  await supabase.auth.signOut();
  redirect("/?compte=supprime");
}
