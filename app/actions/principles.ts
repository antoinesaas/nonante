"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { type ActionResult, userMessage } from "@/lib/errors";
import type { Messages } from "@/lib/i18n/messages";
import { getI18n } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";

// Tout est vérifié dans Postgres (propriétaire, plan, cible, difficulté recalculée, versions pendant l'arc).
// Ici : validation des entrées et limitation de débit.

const principleSchema = (p: Messages["actions"]["principle"]) =>
  z.object({
    id: z.uuid().nullable(),
    pillar: z.enum(["focus", "corps", "business", "esprit", "energie"], { error: p.pickPillar }),
    ifText: z.string().trim().min(2, { error: p.writeIf }).max(120),
    thenText: z.string().trim().min(2, { error: p.writeThen }).max(160),
    proofType: z.enum(["session", "reps", "reveil", "photo", "capture", "lien", "declaratif"], { error: p.pickProof }),
    days: z.array(z.coerce.number().int().min(1).max(7)).min(1, { error: p.pickDay }).max(7),
    difficulty: z.coerce.number().int().min(1).max(3),
    target: z.record(z.string(), z.unknown()),
  });

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && String(value ?? "").trim() !== "" ? n : null;
}

/** Cible selon la preuve, à partir des champs du formulaire. */
function targetFrom(proof: string, formData: FormData): Record<string, unknown> {
  const target: Record<string, unknown> = {};
  const time = (name: string) => {
    const v = String(formData.get(name) ?? "");
    return /^([01]\d|2[0-3]):(00|15|30|45)$/.test(v) ? v : null;
  };
  if (proof === "session") {
    target.minutes = numberOrNull(formData.get("minutes"));
    if (time("before")) target.before = time("before");
  } else if (proof === "reps") {
    target.exercise = formData.get("exercise") === "squat" ? "squat" : "pushup";
    target.reps = numberOrNull(formData.get("reps"));
  } else if (proof === "reveil") {
    target.before = time("wake");
  } else if (proof === "photo") {
    if (time("after")) target.after = time("after");
  } else if (proof === "lien") {
    const domains = formData.getAll("domains").map(String).filter(Boolean);
    if (domains.length) target.domains = domains;
  }
  const count = numberOrNull(formData.get("count"));
  if (count && ["capture", "declaratif", "photo", "lien"].includes(proof)) {
    target.count = Math.round(count);
    const unit = String(formData.get("unit") ?? "").trim().slice(0, 20);
    if (unit) target.unit = unit;
  }
  return target;
}

export async function savePrinciple(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  if (!(await rateLimit("principle", 60, 600))) return { ok: false, message: a.tooManyEdits };

  const proof = String(formData.get("proofType") ?? "");
  const parsed = principleSchema(a.principle).safeParse({
    id: formData.get("id") ? String(formData.get("id")) : null,
    pillar: formData.get("pillar"),
    ifText: String(formData.get("ifText") ?? ""),
    thenText: String(formData.get("thenText") ?? ""),
    proofType: proof,
    days: formData.getAll("days"),
    difficulty: formData.get("difficulty") || 1,
    target: targetFrom(proof, formData),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? a.principle.incomplete };
  const p = parsed.data;

  const { error } = await supabase.rpc("save_principle", {
    p_id: p.id,
    p_pillar: p.pillar,
    p_if: p.ifText,
    p_then: p.thenText,
    p_proof_type: p.proofType,
    p_target: p.target as never,
    p_days: p.days,
    p_difficulty: p.difficulty,
  });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app/principes");
  revalidatePath("/app");
  return { ok: true, message: p.id ? a.principle.edited : a.principle.added };
}

export async function addTemplate(code: string): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  if (!/^[a-z0-9_]{2,40}$/.test(code)) return { ok: false, message: a.principle.unknownTemplate };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  if (!(await rateLimit("principle", 60, 600))) return { ok: false, message: a.tooManyEdits };
  const { error } = await supabase.rpc("add_template_principle", { p_code: code });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app/principes");
  revalidatePath("/app");
  return { ok: true, message: a.principle.added };
}

export async function removePrinciple(id: string): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  if (!z.uuid().safeParse(id).success) return { ok: false, message: a.invalid };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  const { error } = await supabase.rpc("remove_principle", { p_id: id });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app/principes");
  revalidatePath("/app");
  return { ok: true, message: a.principle.removed };
}

export async function regeneratePrinciples(): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  const { error } = await supabase.rpc("regenerate_principles");
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app/principes");
  return { ok: true, message: a.principle.regenerated };
}

export async function setStartDate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: a.principle.invalidDate };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  const { error } = await supabase.rpc("set_start_date", { p_date: date });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app");
  revalidatePath("/app/principes");
  return { ok: true, message: a.principle.startChanged };
}
