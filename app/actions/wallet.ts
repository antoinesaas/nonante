"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { type ActionResult, userMessage } from "@/lib/errors";
import { removeProofPhotos, storeProofPhoto } from "@/lib/photos";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const Entry = z.object({
  amount: z.number({ error: "Montant invalide." }).positive({ error: "Montant invalide." }).max(1_000_000),
  source: z.enum(["vente", "client", "freelance", "contenu", "autre"], { error: "Choisis la source." }),
  label: z.string().trim().min(2, { error: "Libellé : au moins 2 caractères." }).max(80),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Revenu noté dans le portefeuille ; avec une capture, il devient « prouvé » (vérifiée et ré-encodée par le serveur). */
export async function addWalletEntry(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  if (!(await rateLimit("wallet", 30, 3600))) return { ok: false, message: "Trop d'ajouts. Réessaie plus tard." };

  const parsed = Entry.safeParse({
    amount: Number(String(formData.get("amount") ?? "").replace(/\s/g, "").replace(",", ".")),
    source: formData.get("source"),
    label: String(formData.get("label") ?? ""),
    day: String(formData.get("day") ?? ""),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revenu invalide." };

  let path: string | null = null;
  const file = formData.get("proof");
  if (file instanceof File && file.size > 0) {
    const stored = await storeProofPhoto(user.id, file);
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
    return { ok: false, message: userMessage(error) };
  }
  const r = data as { status: string; points: number; audit: boolean };
  revalidatePath("/app/portefeuille");
  revalidatePath("/app");
  if (r.audit) return { ok: true, message: "Revenu prouvé, +15 points. Contrôle : envoie une photo de ta preuve sous 24 h." };
  if (r.status === "proven") return { ok: true, message: r.points ? "Revenu prouvé. +15 points." : "Revenu prouvé." };
  return { ok: true, message: "Revenu noté. Ajoute une capture la prochaine fois pour qu'il compte." };
}

export async function deleteWalletEntry(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Requête invalide." };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  const { error } = await supabase.rpc("delete_wallet_entry", { p_id: id });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/app/portefeuille");
  return { ok: true, message: "Retiré." };
}
