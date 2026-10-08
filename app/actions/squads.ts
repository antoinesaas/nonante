"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { type ActionResult, userMessage } from "@/lib/errors";
import { fmt } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";

export async function createSquad(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  if (!(await rateLimit("squad", 10, 3600))) return { ok: false, message: a.tooMany };
  const { data, error } = await supabase.rpc("create_squad", {
    p_name: String(formData.get("name") ?? "").slice(0, 60),
    p_description: String(formData.get("description") ?? "").slice(0, 200) || null,
    p_is_public: formData.get("isPublic") === "on",
  });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app/escouades");
  return { ok: true, message: fmt(a.squad.created, { code: data as string }) };
}

export async function joinSquad(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return { ok: false, message: a.squad.codeLength };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  if (!(await rateLimit("squad-join", 20, 3600))) return { ok: false, message: a.tooMany };
  const { error } = await supabase.rpc("join_squad", { p_code: code });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app/escouades");
  return { ok: true, message: a.squad.welcome };
}

export async function joinPublicSquad(id: string): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  if (!z.uuid().safeParse(id).success) return { ok: false, message: a.invalid };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  const { error } = await supabase.rpc("join_public_squad", { p_id: id });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app/escouades");
  return { ok: true, message: a.squad.welcome };
}

export async function leaveSquad(id: string): Promise<ActionResult> {
  const i18n = await getI18n();
  const a = i18n.m.actions;
  if (!z.uuid().safeParse(id).success) return { ok: false, message: a.invalid };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: a.loginFirst };
  const { error } = await supabase.rpc("leave_squad", { p_id: id });
  if (error) return { ok: false, message: userMessage(error, i18n) };
  revalidatePath("/app/escouades");
  return { ok: true, message: a.squad.left };
}
