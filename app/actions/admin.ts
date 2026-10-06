"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { type ActionResult, userMessage } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

// Les fonctions admin vérifient elles-mêmes is_admin et la double authentification (aal2),
// à partir du jeton de l'utilisateur. Chaque action est écrite dans audit_log.

const Id = z.uuid();

async function session() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/admin");
  return supabase;
}

export async function reviewAudit(auditId: string, pass: boolean): Promise<ActionResult> {
  if (!Id.safeParse(auditId).success) return { ok: false, message: "Requête invalide." };
  const supabase = await session();
  const { error } = await supabase.rpc("admin_review_audit", { p_audit_id: auditId, p_pass: pass });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/admin/controles");
  return { ok: true, message: pass ? "Contrôle accepté." : "Contrôle refusé." };
}

/** URL signée de 60 s pour voir une photo de preuve (journalisé). */
export async function proofUrl(auditId: string, which: "audit" | "proof"): Promise<{ url?: string; message?: string }> {
  if (!Id.safeParse(auditId).success) return { message: "Requête invalide." };
  const supabase = await session();
  const { data: path, error } = await supabase.rpc("admin_proof_path", { p_audit_id: auditId, p_which: which });
  if (error || !path) return { message: userMessage(error, "Aucune photo.") };
  const { data } = await createAdminClient().storage.from("proofs").createSignedUrl(path, 60);
  return data?.signedUrl ? { url: data.signedUrl } : { message: "Photo introuvable (peut-être supprimée après 30 jours)." };
}

export async function resolveReport(reportId: string, status: "dismissed" | "actioned", hideProfile: boolean): Promise<ActionResult> {
  if (!Id.safeParse(reportId).success) return { ok: false, message: "Requête invalide." };
  const supabase = await session();
  const { error } = await supabase.rpc("admin_resolve_report", {
    p_report_id: reportId,
    p_status: status,
    p_hide_profile: hideProfile,
  });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/admin/signalements");
  return { ok: true, message: "Traité." };
}

const Squad = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(3).max(40),
  description: z.string().trim().max(160),
  startDate: z.iso.date().nullable(),
  isPublic: z.boolean(),
});

/** Escouade officielle (départ collectif possible). */
export async function saveSquad(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = Squad.safeParse({
    id: formData.get("id") ? String(formData.get("id")) : null,
    name: formData.get("name"),
    description: String(formData.get("description") ?? ""),
    startDate: formData.get("startDate") ? String(formData.get("startDate")) : null,
    isPublic: formData.get("isPublic") === "on",
  });
  if (!parsed.success) return { ok: false, message: "Champs invalides." };
  const supabase = await session();
  const s = parsed.data;
  const { error } = await supabase.rpc("admin_save_squad", {
    p_id: s.id,
    p_name: s.name,
    p_description: s.description,
    p_start_date: s.startDate,
    p_is_public: s.isPublic,
  });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/admin/escouades");
  return { ok: true, message: "Escouade enregistrée." };
}

const Comp = z.object({
  pseudo: z.string().trim().min(3).max(20),
  plan: z.enum(["essentiel", "pro"]),
  until: z.iso.date().nullable(),
});

/** Accès offert (tests, partenaires) jusqu'à une date ; date vide : retiré. */
export async function grantComp(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = Comp.safeParse({
    pseudo: formData.get("pseudo"),
    plan: formData.get("plan"),
    until: formData.get("until") ? String(formData.get("until")) : null,
  });
  if (!parsed.success) return { ok: false, message: "Champs invalides." };
  const supabase = await session();
  const { error } = await supabase.rpc("admin_grant_comp", {
    p_pseudo: parsed.data.pseudo,
    p_plan: parsed.data.plan,
    p_until: parsed.data.until,
  });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/admin");
  return { ok: true, message: parsed.data.until ? "Accès offert." : "Accès retiré." };
}

// ---------------------------------------------------------------------------
// Double authentification (TOTP), obligatoire pour l'admin
// ---------------------------------------------------------------------------
export type MfaEnrollment = { factorId: string; qr: string; secret: string } | { message: string };

export async function mfaEnroll(): Promise<MfaEnrollment> {
  const supabase = await session();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  // Repart de zéro si une inscription précédente n'a jamais été vérifiée.
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Nonante admin" });
  if (error || !data) return { message: "Impossible de démarrer la double authentification." };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function mfaVerify(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const factorId = Id.safeParse(formData.get("factorId"));
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!factorId.success || !/^\d{6}$/.test(code)) return { ok: false, message: "Code à 6 chiffres attendu." };
  const supabase = await session();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factorId.data, code });
  if (error) return { ok: false, message: "Code incorrect." };
  redirect("/admin");
}
