"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { sendAuditRequest } from "@/lib/emails";
import { userMessage } from "@/lib/errors";
import { removeProofPhotos, storeProofPhoto } from "@/lib/photos";
import { sendPush } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DayDetail, StartedSession } from "@/lib/types";

// Les vérifications qui comptent (propriétaire, jour, heure, plausibilité) sont faites dans Postgres.
// Ici : validation des entrées, limitation de débit, et notifications.

export type ProofResult = { ok: boolean; message: string | null; points?: number; audit?: boolean };

const Id = z.uuid();
const Nonce = z.string().regex(/^[0-9a-f]{64}$/);
const TOO_FAST: ProofResult = { ok: false, message: "Trop de tentatives. Réessaie dans quelques minutes." };

type ValidationResult = { validation_id: string; points: number; audit: boolean };

function done(result: ValidationResult | null | undefined, base = "Validé."): ProofResult {
  if (!result) return { ok: true, message: base };
  const points = `+${result.points} points.`;
  return {
    ok: true,
    points: result.points,
    audit: result.audit,
    message: result.audit ? `${points} Contrôle : envoie une photo de ta preuve sous 24 h.` : `${base} ${points}`,
  };
}

/** Contrôle déclenché : prévient tout de suite (push et email, une seule fois). */
async function notifyAudit(userId: string, email: string | undefined, filter: { validationId?: string; proofId?: string }) {
  try {
    const admin = createAdminClient();
    let query = admin.from("audits").select("id, due_at").eq("user_id", userId).eq("status", "open");
    query = filter.validationId ? query.eq("validation_id", filter.validationId) : query.eq("challenge_proof_id", filter.proofId!);
    const { data: audit } = await query.maybeSingle();
    if (!audit) return;
    await sendPush(userId, { title: "Contrôle", body: "Envoie une photo de ta preuve sous 24 h.", url: `/app/controle/${audit.id}` });
    const { data: first } = await admin.rpc("log_email_once", { p_user: userId, p_kind: "audit", p_ref: audit.id });
    if (first && email) await sendAuditRequest(email, audit.id, audit.due_at, null);
  } catch (e) {
    console.error(`[audit] notification impossible : ${e instanceof Error ? e.name : "erreur"}`);
  }
}

async function context(action: string, max = 30) {
  const { supabase, user } = await getUser();
  if (!user) return { error: { ok: false, message: "Connecte-toi pour continuer." } as ProofResult };
  if (!(await rateLimit(action, max, 600))) return { error: TOO_FAST };
  return { supabase, user };
}

export async function validateDeclaratif(principleId: string): Promise<ProofResult> {
  if (!Id.safeParse(principleId).success) return { ok: false, message: "Requête invalide." };
  const ctx = await context("validate");
  if ("error" in ctx) return ctx.error!;
  const { data, error } = await ctx.supabase.rpc("validate_declaratif", { p_principle_id: principleId });
  if (error) return { ok: false, message: userMessage(error) };
  const result = data as ValidationResult;
  if (result.audit) await notifyAudit(ctx.user.id, ctx.user.email, { validationId: result.validation_id });
  revalidatePath("/app");
  return done(result);
}

export async function validateLink(_prev: ProofResult, formData: FormData): Promise<ProofResult> {
  const principleId = String(formData.get("principleId") ?? "");
  const url = String(formData.get("url") ?? "").slice(0, 600);
  if (!Id.safeParse(principleId).success) return { ok: false, message: "Requête invalide." };
  const ctx = await context("validate");
  if ("error" in ctx) return ctx.error!;
  const { data, error } = await ctx.supabase.rpc("validate_link", { p_principle_id: principleId, p_url: url });
  if (error) return { ok: false, message: userMessage(error) };
  const result = data as ValidationResult;
  if (result.audit) await notifyAudit(ctx.user.id, ctx.user.email, { validationId: result.validation_id });
  revalidatePath("/app");
  return done(result, "Lien validé.");
}

/** Photo prise dans l'app : principe, contrôle ou épreuve. */
export async function submitPhoto(_prev: ProofResult, formData: FormData): Promise<ProofResult> {
  const kind = z.enum(["principle", "audit", "challenge"]).safeParse(formData.get("kind"));
  const targetId = Id.safeParse(formData.get("targetId"));
  if (!kind.success || !targetId.success) return { ok: false, message: "Requête invalide." };
  const ctx = await context("upload", 10);
  if ("error" in ctx) return ctx.error!;

  const stored = await storeProofPhoto(ctx.user.id, formData.get("photo"));
  if ("error" in stored) return { ok: false, message: stored.error };

  const admin = createAdminClient();
  let result: ProofResult;
  if (kind.data === "principle") {
    const { data, error } = await admin.rpc("validate_photo", { p_user: ctx.user.id, p_principle_id: targetId.data, p_path: stored.path });
    if (error) {
      await removeProofPhotos([stored.path]);
      return { ok: false, message: userMessage(error) };
    }
    const validation = data as ValidationResult;
    if (validation.audit) await notifyAudit(ctx.user.id, ctx.user.email, { validationId: validation.validation_id });
    result = done(validation, "Photo validée.");
  } else if (kind.data === "audit") {
    const { error } = await admin.rpc("submit_audit_photo", { p_user: ctx.user.id, p_audit_id: targetId.data, p_path: stored.path });
    if (error) {
      await removeProofPhotos([stored.path]);
      return { ok: false, message: userMessage(error) };
    }
    result = { ok: true, message: "Preuve envoyée. Elle sera examinée." };
  } else {
    const { data, error } = await admin.rpc("validate_challenge_photo", {
      p_user: ctx.user.id,
      p_assignment_id: targetId.data,
      p_path: stored.path,
    });
    if (error) {
      await removeProofPhotos([stored.path]);
      return { ok: false, message: userMessage(error) };
    }
    const r = data as { status: string; audit: boolean };
    result = { ok: true, message: r.status === "done" ? "Épreuve réussie." : "Preuve enregistrée." };
  }
  revalidatePath("/app");
  return result;
}

// ---------------------------------------------------------------------------
// Sessions : minuteur, répétitions, réveil
// ---------------------------------------------------------------------------
export async function startSession(principleId: string): Promise<{ session?: StartedSession; message?: string }> {
  if (!Id.safeParse(principleId).success) return { message: "Requête invalide." };
  const ctx = await context("session", 20);
  if ("error" in ctx) return { message: ctx.error!.message ?? undefined };
  const { data, error } = await ctx.supabase.rpc("start_proof_session", { p_principle_id: principleId });
  if (error) return { message: userMessage(error) };
  return { session: data as StartedSession };
}

export async function startChallengeSession(
  assignmentId: string,
  minutes: number | null,
): Promise<{ session?: StartedSession; message?: string }> {
  if (!Id.safeParse(assignmentId).success) return { message: "Requête invalide." };
  if (minutes !== null && ![25, 50, 90].includes(minutes)) return { message: "Durée invalide." };
  const ctx = await context("session", 20);
  if ("error" in ctx) return { message: ctx.error!.message ?? undefined };
  const { data, error } = await ctx.supabase.rpc("start_challenge_session", { p_assignment_id: assignmentId, p_minutes: minutes });
  if (error) return { message: userMessage(error) };
  return { session: data as StartedSession };
}

export type SessionStatus = { status: string; reason?: string; heartbeats?: number; elapsed?: number; message?: string };

export async function heartbeat(sessionId: string, nonce: string, visible: boolean, hiddenMs: number): Promise<SessionStatus> {
  if (!Id.safeParse(sessionId).success || !Nonce.safeParse(nonce).success) return { status: "error", message: "Requête invalide." };
  const ctx = await context("heartbeat", 200);
  if ("error" in ctx) return { status: "error", message: ctx.error!.message ?? undefined };
  const { data, error } = await ctx.supabase.rpc("heartbeat", {
    p_session_id: sessionId,
    p_nonce: nonce,
    p_visible: Boolean(visible),
    p_hidden_ms: Math.max(0, Math.min(Math.round(hiddenMs), 86_400_000)),
  });
  if (error) return { status: "error", message: userMessage(error) };
  return data as SessionStatus;
}

export async function completeSession(sessionId: string, nonce: string): Promise<SessionStatus & { points?: number }> {
  if (!Id.safeParse(sessionId).success || !Nonce.safeParse(nonce).success) return { status: "error", message: "Requête invalide." };
  const ctx = await context("session", 20);
  if ("error" in ctx) return { status: "error", message: ctx.error!.message ?? undefined };
  const { data, error } = await ctx.supabase.rpc("complete_session", { p_session_id: sessionId, p_nonce: nonce });
  if (error) return { status: "error", message: userMessage(error) };
  revalidatePath("/app");
  const r = data as { status: string; reason?: string; validation?: ValidationResult | null };
  return { status: r.status, reason: r.reason, points: r.validation?.points };
}

export async function abandonSession(sessionId: string, nonce: string): Promise<SessionStatus> {
  if (!Id.safeParse(sessionId).success || !Nonce.safeParse(nonce).success) return { status: "error", message: "Requête invalide." };
  const ctx = await context("session", 20);
  if ("error" in ctx) return { status: "error", message: ctx.error!.message ?? undefined };
  const { data, error } = await ctx.supabase.rpc("abandon_session", { p_session_id: sessionId, p_nonce: nonce });
  if (error) return { status: "error", message: userMessage(error) };
  revalidatePath("/app");
  return data as SessionStatus;
}

const Reps = z.array(z.tuple([z.number().nonnegative().max(3_600_000), z.number().nonnegative().max(3_600_000)])).max(1000);

export async function completeReps(sessionId: string, nonce: string, reps: unknown): Promise<SessionStatus & { points?: number; count?: number }> {
  const parsed = Reps.safeParse(reps);
  if (!Id.safeParse(sessionId).success || !Nonce.safeParse(nonce).success || !parsed.success) {
    return { status: "error", message: "Requête invalide." };
  }
  const ctx = await context("session", 20);
  if ("error" in ctx) return { status: "error", message: ctx.error!.message ?? undefined };
  const rounded = parsed.data.map(([a, b]) => [Math.round(a), Math.round(b)]);
  const { data, error } = await ctx.supabase.rpc("complete_reps", { p_session_id: sessionId, p_nonce: nonce, p_reps: rounded });
  if (error) return { status: "error", message: userMessage(error) };
  revalidatePath("/app");
  const r = data as { status: string; reason?: string; count?: number; validation?: ValidationResult | null };
  return { status: r.status, reason: r.reason, count: r.count, points: r.validation?.points };
}

export async function completeWake(sessionId: string, nonce: string, code: string): Promise<SessionStatus & { points?: number; error?: string }> {
  if (!Id.safeParse(sessionId).success || !Nonce.safeParse(nonce).success) return { status: "error", message: "Requête invalide." };
  const ctx = await context("wake", 20);
  if ("error" in ctx) return { status: "error", message: ctx.error!.message ?? undefined };
  const { data, error } = await ctx.supabase.rpc("complete_wake_check", {
    p_session_id: sessionId,
    p_nonce: nonce,
    p_code: code.replace(/\D/g, "").slice(0, 6),
  });
  if (error) return { status: "error", message: userMessage(error) };
  revalidatePath("/app");
  const r = data as { status: string; reason?: string; error?: string; validation?: ValidationResult | null };
  return { status: r.status, reason: r.reason, error: r.error, points: r.validation?.points };
}

// ---------------------------------------------------------------------------
// Épreuves
// ---------------------------------------------------------------------------
export async function validateChallengeDeclaratif(assignmentId: string): Promise<ProofResult> {
  if (!Id.safeParse(assignmentId).success) return { ok: false, message: "Requête invalide." };
  const ctx = await context("validate");
  if ("error" in ctx) return ctx.error!;
  const { data, error } = await ctx.supabase.rpc("validate_challenge_declaratif", { p_assignment_id: assignmentId });
  if (error) return { ok: false, message: userMessage(error) };
  const r = data as { status: string; audit: boolean };
  if (r.audit) {
    const { data: proof } = await ctx.supabase
      .from("challenge_proofs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .eq("kind", "declaratif")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (proof) await notifyAudit(ctx.user.id, ctx.user.email, { proofId: proof.id });
  }
  revalidatePath("/app");
  return {
    ok: true,
    audit: r.audit,
    message: r.audit ? "Contrôle : envoie une capture ou une photo sous 24 h." : r.status === "done" ? "Épreuve réussie." : "Noté.",
  };
}

export async function validateChallengeLink(_prev: ProofResult, formData: FormData): Promise<ProofResult> {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  if (!Id.safeParse(assignmentId).success) return { ok: false, message: "Requête invalide." };
  const ctx = await context("validate");
  if ("error" in ctx) return ctx.error!;
  const { data, error } = await ctx.supabase.rpc("validate_challenge_link", {
    p_assignment_id: assignmentId,
    p_url: String(formData.get("url") ?? "").slice(0, 600),
  });
  if (error) return { ok: false, message: userMessage(error) };
  const r = data as { status: string };
  revalidatePath("/app");
  return { ok: true, message: r.status === "done" ? "Épreuve réussie." : "Lien enregistré." };
}

export async function getDayDetail(day: string): Promise<DayDetail | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const { supabase, user } = await getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("day_detail", { p_day: day });
  return (data as DayDetail | null) ?? null;
}
