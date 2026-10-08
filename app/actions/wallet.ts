"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { type ActionResult, userMessage } from "@/lib/errors";
import type { Messages } from "@/lib/i18n/messages";
import { getI18n } from "@/lib/i18n/server";
import { removeProofPhotos, storeProofPhoto } from "@/lib/photos";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const entrySchema = (w: Messages["actions"]["wallet"]) =>
  z.object({
    amount: z.number({ error: w.invalidAmount }).positive({ error: w.invalidAmount }).max(1_000_000),
    source: z.enum(["vente", "client", "freelance", "contenu", "autre"], { error: w.pickSource }),
    label: z.string().trim().min(2, { error: w.labelMin }).max(80),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

/** Revenu noté dans le portefeuille ; avec une capture, il devient « prouvé » (vérifiée et ré-encodée par le serveur). */
export async function addWalletEntry(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const { user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  if (!(await rateLimit("wallet", 30, 3600))) return { ok: false, message: a.wallet.tooMany };

  const parsed = entrySchema(a.wallet).safeParse({
    amount: Number(String(formData.get("amount") ?? "").replace(/\s/g, "").replace(",", ".")),
    source: formData.get("source"),
    label: String(formData.get("label") ?? ""),
    day: String(formData.get("day") ?? ""),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? a.wallet.invalid };

  let path: string | null = null;
  const file = formData.get("proof");
  if (file instanceof File && file.size > 0) {
    const stored = await storeProofPhoto(user.id, file, a.photo);
    if ("error" in stored) return { ok: false, message: stored.error };
    path = stored.path;
  }

  const { data, error } = await createAdminClient().rpc("add_wallet_entry", {
    p_user: user.id,
    p_amount_cents: Math.round(parsed.data.amount * 100),
    p_source: parsed.data.source,
    p_label: parsed.data.label,
    p_day: parsed.data.day,
    p_proof_path: path,
  });
  if (error) {
    if (path) await removeProofPhotos([path]);
    return { ok: false, message: userMessage(error, i18n) };
  }
  const r = data as { status: string; points: number; audit: boolean };
  revalidatePath("/app/portefeuille");
  revalidatePath("/app");
  if (r.audit) return { ok: true, message: a.wallet.provenAudit };
  if (r.status === "proven") return { ok: true, message: r.points ? a.wallet.provenPoints : a.wallet.proven };
  return { ok: true, message: a.wallet.noted };
}

export async function deleteWalletEntry(id: string): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  if (!z.uuid().safeParse(id).success) return { ok: false, message: a.invalid };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  const { error } = await supabase.rpc("delete_wallet_entry", { p_id: id });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app/portefeuille");
  return { ok: true, message: a.wallet.removed };
}
