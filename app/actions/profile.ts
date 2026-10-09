"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { type ActionResult, userMessage } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { removeAvatars, removeProofPhotos, storeAvatar } from "@/lib/photos";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  const art = formData.get("art");
  const { error } = await supabase.rpc("update_profile_settings", {
    p_is_public: formData.get("isPublic") === "on",
    p_art_slug: typeof art === "string" && /^[a-z0-9-]{1,60}$/.test(art) ? art : null,
    p_email_reminders: null,
    p_wallet_public: formData.get("walletPublic") === "on",
    p_bio: String(formData.get("bio") ?? "").slice(0, 200),
  });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app/profil");
  return { ok: true, message: a.profile.saved };
}

/** Fond de la carte de joueur, choisi depuis la carte (crayon). Postgres vérifie qu'il est débloqué. */
export async function setCardArt(slug: string): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return { ok: false, message: a.invalid };
  // Les autres réglages à null restent inchangés (coalesce côté Postgres).
  const { error } = await supabase.rpc("update_profile_settings", {
    p_is_public: null,
    p_art_slug: slug,
    p_email_reminders: null,
    p_wallet_public: null,
    p_bio: null,
  });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app/profil");
  return { ok: true, message: a.profile.cardSaved };
}

/** Photo de profil : vérifiée, recadrée en carré 512 px, ré-encodée (sans métadonnées) dans le bucket public. */
export async function uploadAvatar(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const { user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  if (!(await rateLimit("avatar", 10, 3600))) return { ok: false, message: a.profile.tooManyPhotos };
  const stored = await storeAvatar(user.id, formData.get("avatar"), a.photo);
  if ("error" in stored) return { ok: false, message: stored.error };
  const { data: old, error } = await createAdminClient().rpc("set_avatar", { p_user: user.id, p_path: stored.path });
  if (error) {
    await removeAvatars([stored.path]);
    return { ok: false, message: userMessage(error, i18n) };
  }
  if (old) await removeAvatars([old as string]);
  revalidatePath("/app/profil");
  revalidatePath("/app");
  return { ok: true, message: a.profile.photoSaved };
}

export async function removeAvatar(): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const { user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  const { data: old, error } = await createAdminClient().rpc("set_avatar", { p_user: user.id, p_path: null as unknown as string });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  if (old) await removeAvatars([old as string]);
  revalidatePath("/app/profil");
  return { ok: true, message: a.profile.photoRemoved };
}

export async function reportUser(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.profile.reportLogin };
  if (!(await rateLimit("report", 10, 86400))) return { ok: false, message: a.profile.reportTooMany };
  const { error } = await supabase.rpc("report_user", {
    p_pseudo: String(formData.get("pseudo") ?? "").slice(0, 40),
    p_reason: String(formData.get("reason") ?? "").slice(0, 500),
  });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  return { ok: true, message: a.profile.reportSent };
}

/** Suppression de compte (RGPD) : données de jeu, photos, puis compte d'authentification. */
export async function deleteAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  const { data: profile } = await supabase.from("profiles").select("pseudo").eq("id", user.id).maybeSingle();
  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (profile && typed !== profile.pseudo) return { ok: false, message: a.profile.confirmPseudo };

  const { data: files, error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, message: userMessage(error, i18n) };
  const f = (files as { proofs: string[]; avatars: string[] } | null) ?? { proofs: [], avatars: [] };
  await removeProofPhotos(f.proofs);
  await removeAvatars(f.avatars);
  const { error: authError } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (authError) console.error(`[compte] suppression auth impossible : ${authError.code ?? "erreur"}`);
  await supabase.auth.signOut();
  redirect("/?compte=supprime");
}
