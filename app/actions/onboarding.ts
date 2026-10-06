"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { todayParis } from "@/lib/dates";
import { userMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { ensureReferralCode } from "@/lib/stripe-codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseUtm, UTM_COOKIE } from "@/lib/utm";

export type OnboardingState = { message: string | null };

const Profile = z.object({
  pseudo: z.string().max(40),
  birthYear: z.coerce.number().int().min(1900).max(2100),
  isPublic: z.boolean(),
  adult: z.boolean(),
});

const Arc = z.object({
  category: z.enum(["etudes", "business", "mixte"], { error: "Choisis ton profil." }),
  goalType: z.enum(["revenu", "clients", "lancement", "audience", "examens", "corps", "autre"], { error: "Choisis ton objectif." }),
  goal: z.string().trim().min(3, { error: "Ton objectif : au moins 3 caractères." }).max(120),
  goalTarget: z.number().positive().max(999_999_999).nullable(),
  goalUnit: z.string().trim().max(20).nullable(),
  goalPublic: z.boolean(),
  weakPoints: z.array(z.enum(["telephone", "procrastination", "reveil", "sport", "dispersion", "vente", "regularite"])).max(7),
  wakeTime: z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, { error: "Heure de lever invalide." }),
  pushups: z.enum(["oui", "quelques", "non"], { error: "Réponds à la question sur les pompes." }),
  focusMinutes: z.union([z.literal(25), z.literal(50), z.literal(90)]),
  start: z.string().regex(/^(today|tomorrow|monday|date:\d{4}-\d{2}-\d{2}|squad:[0-9a-f-]{36})$/, { error: "Choisis ton jour 1." }),
});

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Jour 1 calculé côté serveur, en heure de Paris. */
function startDate(choice: string): { date: string; squadId: string | null } {
  const today = todayParis();
  if (choice === "tomorrow") return { date: addDays(today, 1), squadId: null };
  if (choice === "monday") {
    const isodow = ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    return { date: addDays(today, 8 - isodow), squadId: null };
  }
  if (choice.startsWith("date:")) return { date: choice.slice(5), squadId: null };
  if (choice.startsWith("squad:")) return { date: today, squadId: choice.slice(6) };
  return { date: today, squadId: null };
}

/** Crée (ou met à jour) le profil et l'arc ; les principes sont proposés côté serveur, puis modifiables. */
export async function buildArc(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/onboarding");
  if (!(await rateLimit("onboarding", 15, 600))) return { message: "Trop de tentatives. Réessaie dans quelques minutes." };

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!existing) {
    const parsed = Profile.safeParse({
      pseudo: String(formData.get("pseudo") ?? ""),
      birthYear: formData.get("birthYear") || 0,
      isPublic: formData.get("isPublic") === "oui",
      adult: formData.get("adult") === "on",
    });
    if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Profil incomplet." };
    const utm = parseUtm((await cookies()).get(UTM_COOKIE)?.value);
    const { error } = await supabase.rpc("save_profile", {
      p_pseudo: parsed.data.pseudo,
      p_birth_year: parsed.data.birthYear,
      p_adult: parsed.data.adult,
      p_is_public: parsed.data.isPublic,
      p_utm_source: utm.source,
      p_utm_campaign: utm.campaign,
    });
    if (error) return { message: userMessage(error) };
  }

  const target = String(formData.get("goalTarget") ?? "").replace(/\s/g, "").replace(",", ".");
  const parsed = Arc.safeParse({
    category: formData.get("category"),
    goalType: formData.get("goalType"),
    goal: String(formData.get("goal") ?? ""),
    goalTarget: target ? Number(target) : null,
    goalUnit: String(formData.get("goalUnit") ?? "").trim() || null,
    goalPublic: formData.get("goalPublic") === "oui",
    weakPoints: formData.getAll("weakPoints").map(String),
    wakeTime: String(formData.get("wakeTime") ?? ""),
    pushups: formData.get("pushups"),
    focusMinutes: Number(formData.get("focusMinutes")),
    start: String(formData.get("start") ?? ""),
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Réponses incomplètes." };
  const a = parsed.data;
  const start = startDate(a.start);

  const { error } = await supabase.rpc("save_arc", {
    p_category: a.category,
    p_goal_type: a.goalType,
    p_goal_title: a.goal,
    p_goal_target: a.goalTarget,
    p_goal_unit: a.goalUnit,
    p_goal_public: a.goalPublic,
    p_weak_points: a.weakPoints,
    p_wake_time: a.wakeTime,
    p_pushups: a.pushups,
    p_focus_minutes: a.focusMinutes,
    p_start_date: start.date,
    p_squad_id: start.squadId,
  });
  if (error) return { message: userMessage(error) };

  // Code de parrainage personnel (sans bloquer l'onboarding si Stripe est indisponible).
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("referral_code, stripe_promotion_code_id")
    .eq("id", user.id)
    .single();
  if (profile?.referral_code && !profile.stripe_promotion_code_id && process.env.STRIPE_SECRET_KEY) {
    try {
      await ensureReferralCode(user.id, profile.referral_code);
    } catch (e) {
      console.error(`[onboarding] code de parrainage non créé : ${e instanceof Error ? e.name : "erreur"}`);
    }
  }
  redirect("/app/principes?nouveau=1");
}
