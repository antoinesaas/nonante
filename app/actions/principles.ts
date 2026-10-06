"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { type ActionResult, userMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";

// Tout est vérifié dans Postgres (propriétaire, plan, cible, difficulté recalculée, versions pendant l'arc).
// Ici : validation des entrées et limitation de débit.

const Principle = z.object({
  id: z.uuid().nullable(),
  pillar: z.enum(["focus", "corps", "business", "esprit", "energie"], { error: "Choisis un pilier." }),
  ifText: z.string().trim().min(2, { error: "Écris le « si »." }).max(120),
  thenText: z.string().trim().min(2, { error: "Écris le « alors »." }).max(160),
  proofType: z.enum(["session", "reps", "reveil", "photo", "capture", "lien", "declaratif"], { error: "Choisis une preuve." }),
  days: z.array(z.coerce.number().int().min(1).max(7)).min(1, { error: "Choisis au moins un jour." }).max(7),
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
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  if (!(await rateLimit("principle", 60, 600))) return { ok: false, message: "Trop de modifications. Réessaie dans quelques minutes." };

  const proof = String(formData.get("proofType") ?? "");
  const parsed = Principle.safeParse({
    id: formData.get("id") ? String(formData.get("id")) : null,
    pillar: formData.get("pillar"),
    ifText: String(formData.get("ifText") ?? ""),
    thenText: String(formData.get("thenText") ?? ""),
    proofType: proof,
    days: formData.getAll("days"),
    difficulty: formData.get("difficulty") || 1,
    target: targetFrom(proof, formData),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Principe incomplet." };
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
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/app/principes");
  revalidatePath("/app");
  return { ok: true, message: p.id ? "Principe modifié." : "Principe ajouté." };
}

export async function addTemplate(code: string): Promise<ActionResult> {
  if (!/^[a-z0-9_]{2,40}$/.test(code)) return { ok: false, message: "Gabarit inconnu." };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  if (!(await rateLimit("principle", 60, 600))) return { ok: false, message: "Trop de modifications." };
  const { error } = await supabase.rpc("add_template_principle", { p_code: code });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/app/principes");
  revalidatePath("/app");
  return { ok: true, message: "Principe ajouté." };
}

export async function removePrinciple(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Requête invalide." };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  const { error } = await supabase.rpc("remove_principle", { p_id: id });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/app/principes");
  revalidatePath("/app");
  return { ok: true, message: "Principe retiré." };
}

export async function regeneratePrinciples(): Promise<ActionResult> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  const { error } = await supabase.rpc("regenerate_principles");
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/app/principes");
  return { ok: true, message: "Principes proposés à nouveau." };
}

export async function setStartDate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Date invalide." };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  const { error } = await supabase.rpc("set_start_date", { p_date: date });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/app");
  revalidatePath("/app/principes");
  return { ok: true, message: "Jour 1 changé." };
}
