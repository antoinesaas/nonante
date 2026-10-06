"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { type ActionResult, userMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";

export async function createSquad(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  if (!(await rateLimit("squad", 10, 3600))) return { ok: false, message: "Trop de tentatives." };
  const { data, error } = await supabase.rpc("create_squad", {
    p_name: String(formData.get("name") ?? "").slice(0, 60),
    p_description: String(formData.get("description") ?? "").slice(0, 200) || null,
    p_is_public: formData.get("isPublic") === "on",
  });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/app/escouades");
  return { ok: true, message: `Escouade créée. Code à partager : ${data as string}` };
}

export async function joinSquad(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return { ok: false, message: "Un code d'escouade fait 6 caractères." };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  if (!(await rateLimit("squad-join", 20, 3600))) return { ok: false, message: "Trop de tentatives." };
  const { error } = await supabase.rpc("join_squad", { p_code: code });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/app/escouades");
  return { ok: true, message: "Bienvenue dans l'escouade." };
}

export async function joinPublicSquad(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Requête invalide." };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  const { error } = await supabase.rpc("join_public_squad", { p_id: id });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/app/escouades");
  return { ok: true, message: "Bienvenue dans l'escouade." };
}

export async function leaveSquad(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, message: "Requête invalide." };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  const { error } = await supabase.rpc("leave_squad", { p_id: id });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/app/escouades");
  return { ok: true, message: "Tu as quitté l'escouade." };
}
