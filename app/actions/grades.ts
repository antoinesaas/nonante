"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { type ActionResult, userMessage } from "@/lib/errors";
import { getI18n } from "@/lib/i18n/server";
import { removeProofPhotos, storeProofPhoto } from "@/lib/photos";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));

const Grade = z.object({
  subject: z.string().trim().min(2).max(60),
  score: z.number().min(0).max(1000),
  outOf: z.number().positive().max(1000),
  coefficient: z.number().positive().max(100),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Note ajoutée au carnet ; avec une capture, elle devient « prouvée » (vérifiée et ré-encodée par le serveur). */
export async function addGrade(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const { user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  if (!(await rateLimit("grades", 30, 3600))) return { ok: false, message: a.grades.tooMany };

  const parsed = Grade.safeParse({
    subject: String(formData.get("subject") ?? ""),
    score: num(formData.get("score")),
    outOf: num(formData.get("outOf")) || 20,
    coefficient: num(formData.get("coefficient")) || 1,
    day: String(formData.get("day") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.path[0] === "subject" ? a.grades.subject : a.grades.invalid };
  }
  if (parsed.data.score > parsed.data.outOf) return { ok: false, message: a.grades.invalid };

  let path: string | null = null;
  const file = formData.get("proof");
  if (file instanceof File && file.size > 0) {
    const stored = await storeProofPhoto(user.id, file, a.photo);
    if ("error" in stored) return { ok: false, message: stored.error };
    path = stored.path;
  }

  const { data, error } = await createAdminClient().rpc("add_grade", {
    p_user: user.id,
    p_subject: parsed.data.subject,
    p_score: parsed.data.score,
    p_out_of: parsed.data.outOf,
    p_coefficient: parsed.data.coefficient,
    p_day: parsed.data.day,
    p_proof_path: path,
  });
  if (error) {
    if (path) await removeProofPhotos([path]);
    return { ok: false, message: userMessage(error, i18n) };
  }
  const r = data as { status: string; points: number };
  revalidatePath("/app/notes");
  revalidatePath("/app");
  if (r.status === "proven") return { ok: true, message: r.points ? a.grades.provenPoints : a.grades.proven };
  return { ok: true, message: a.grades.noted };
}

export async function deleteGrade(id: string): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  if (!z.uuid().safeParse(id).success) return { ok: false, message: a.invalid };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  const { error } = await supabase.rpc("delete_grade", { p_id: id });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app/notes");
  return { ok: true, message: a.grades.removed };
}
