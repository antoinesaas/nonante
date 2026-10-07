"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Answers, type ArcAnswers, startDateOf } from "@/lib/answers";
import { getUser } from "@/lib/auth";
import { billing, checkoutDestination, validChoice } from "@/lib/checkout";
import { userMessage } from "@/lib/errors";
import { checkEmail, sendOtp, verifyOtp } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";
import { ensureReferralCode } from "@/lib/stripe-codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Interval, PlanId, Preview } from "@/lib/types";
import { parseUtm, UTM_COOKIE } from "@/lib/utm";

// Le parcours du visiteur : questionnaire → construction → plans → compte (email) → dernière étape → paiement.
// Les réponses sont gardées en base le temps de la connexion (le lien peut s'ouvrir dans un autre navigateur).

const SUITE = "/onboarding/suite";

const Choice = z.object({
  plan: z.enum(["arc", "pro", "fondateur"]),
  interval: z.enum(["once", "month", "year", "lifetime"]),
});

function parseAnswers(raw: unknown): ArcAnswers | null {
  try {
    const parsed = Answers.safeParse(typeof raw === "string" ? JSON.parse(raw) : raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function parseChoice(plan: unknown, interval: unknown): { plan: PlanId; interval: Interval } | null {
  const parsed = Choice.safeParse({ plan, interval });
  if (!parsed.success || !validChoice(parsed.data.plan, parsed.data.interval)) return null;
  return parsed.data;
}

async function savePending(email: string, answers: ArcAnswers, choice: { plan: PlanId; interval: Interval }): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("pending_arcs")
    .upsert({ email, answers, plan: choice.plan, plan_interval: choice.interval, created_at: new Date().toISOString() }, { onConflict: "email" });
  if (error) console.error(`[parcours] réponses non gardées (${error.code})`);
  return !error;
}

/** Aperçu des principes, calculé par Postgres à partir des réponses (rien n'est écrit). */
export async function previewArc(raw: string): Promise<Preview | { error: string }> {
  const a = parseAnswers(raw);
  if (!a) return { error: "Il manque une réponse. Reviens en arrière pour vérifier." };
  if (!(await rateLimit("preview", 30, 600))) return { error: "Trop de tentatives. Réessaie dans quelques minutes." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_principles", {
    p_category: a.category,
    p_goal_type: a.goalType,
    p_weak_points: a.weakPoints,
    p_wake_time: a.wakeTime,
    p_pushups: a.pushups,
    p_focus_minutes: a.focusMinutes,
  });
  if (error || !data) return { error: "Construction impossible pour le moment. Réessaie." };
  return data as Preview;
}

export type AccountState = { step: "email" | "code"; email: string; message: string | null };

/** Visiteur : garde ses réponses et son plan, puis envoie le code de connexion. */
export async function sendAccountCode(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const typed = String(formData.get("email") ?? "").trim().toLowerCase();
  const checked = checkEmail(typed);
  if ("error" in checked) return { step: "email", email: typed, message: checked.error };
  const answers = parseAnswers(formData.get("answers"));
  const choice = parseChoice(formData.get("plan"), formData.get("interval"));
  if (!answers || !choice) return { step: "email", email: typed, message: "Il manque une réponse. Reviens au questionnaire." };
  if (!(await savePending(checked.email, answers, choice))) {
    return { step: "email", email: typed, message: "Enregistrement impossible pour le moment. Réessaie." };
  }
  const error = await sendOtp(checked.email, SUITE);
  if (error) return { step: "email", email: typed, message: error };
  return { step: "code", email: checked.email, message: null };
}

/** Visiteur : vérifie le code, puis dernière étape. */
export async function verifyAccountCode(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const error = await verifyOtp(email, formData.get("token"));
  if (error) return { step: error.startsWith("Recommence") ? "email" : "code", email, message: error };
  redirect(SUITE);
}

/** Déjà connecté : garde les réponses et le plan, puis dernière étape. */
export async function continueWithPlan(rawAnswers: string, plan: string, interval: string): Promise<{ error: string }> {
  const { user } = await getUser();
  if (!user?.email) redirect("/onboarding");
  const answers = parseAnswers(rawAnswers);
  const choice = parseChoice(plan, interval);
  if (!answers || !choice) return { error: "Il manque une réponse. Reviens en arrière pour vérifier." };
  if (!(await savePending(user.email.toLowerCase(), answers, choice))) return { error: "Enregistrement impossible pour le moment. Réessaie." };
  redirect(SUITE);
}

export type FinishState = { message: string | null };

const Profile = z.object({
  pseudo: z.string().max(40),
  birthYear: z.coerce.number().int().min(1900).max(2100),
  isPublic: z.boolean(),
  adult: z.boolean(),
});

/**
 * Dernière étape : profil (si besoin), arc construit avec les réponses gardées, puis paiement.
 * Si le plan couvre déjà l'arc (Pro, Fondateur, arc payé d'avance), on va directement au tableau de bord.
 */
export async function finishArc(_prev: FinishState, formData: FormData): Promise<FinishState> {
  const { supabase, user } = await getUser();
  if (!user?.email) redirect("/onboarding");
  if (!(await rateLimit("onboarding", 15, 600))) return { message: "Trop de tentatives. Réessaie dans quelques minutes." };
  const email = user.email.toLowerCase();
  const admin = createAdminClient();

  const { data: pending } = await admin.from("pending_arcs").select("answers, plan, plan_interval").eq("email", email).maybeSingle();
  const answers = parseAnswers(pending?.answers);
  const choice = parseChoice(pending?.plan, pending?.plan_interval);
  if (!answers || !choice) redirect("/onboarding");

  // Profil (première fois).
  const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!existing) {
    const parsed = Profile.safeParse({
      pseudo: String(formData.get("pseudo") ?? ""),
      birthYear: formData.get("birthYear") || 0,
      isPublic: formData.get("isPublic") === "on",
      adult: formData.get("adult") === "on",
    });
    if (!parsed.success) return { message: "Indique ton année de naissance (Nonante est réservé aux majeurs)." };
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

  // Paiement nécessaire ? Alors la demande d'accès immédiat est obligatoire (droit de rétractation).
  const b = await billing(user.id);
  const covered =
    b?.effective_plan === "fondateur" ||
    (choice.plan === "arc" && (b?.effective_plan === "pro" || Boolean(b?.arc_credits))) ||
    (choice.plan === "pro" && b?.effective_plan === "pro");
  if (!covered && formData.get("waiver") !== "on") return { message: "Coche la case pour démarrer tout de suite." };

  // L'arc, construit par Postgres avec les réponses du questionnaire.
  const { data: before } = await supabase.from("enrollments").select("id").eq("user_id", user.id).in("status", ["draft", "active"]).maybeSingle();
  const start = startDateOf(answers.start);
  const { error } = await supabase.rpc("save_arc", {
    p_category: answers.category,
    p_goal_type: answers.goalType,
    p_goal_title: answers.goal,
    p_goal_target: answers.goalTarget,
    p_goal_unit: answers.goalUnit,
    p_goal_public: answers.goalPublic,
    p_weak_points: answers.weakPoints,
    p_wake_time: answers.wakeTime,
    p_pushups: answers.pushups,
    p_focus_minutes: answers.focusMinutes,
    p_start_date: start.date,
    p_squad_id: start.squadId,
  });
  if (error) return { message: userMessage(error) };
  // Arc déjà construit (questionnaire refait avant le jour 1) : principes recalculés avec les nouvelles réponses.
  if (before) await supabase.rpc("regenerate_principles");
  await admin.from("pending_arcs").delete().eq("email", email);

  // Code de parrainage personnel (sans bloquer le parcours si Stripe est indisponible).
  const { data: profile } = await admin.from("profiles").select("referral_code, stripe_promotion_code_id").eq("id", user.id).single();
  if (profile?.referral_code && !profile.stripe_promotion_code_id && process.env.STRIPE_SECRET_KEY) {
    try {
      await ensureReferralCode(user.id, profile.referral_code);
    } catch (e) {
      console.error(`[parcours] code de parrainage non créé : ${e instanceof Error ? e.name : "erreur"}`);
    }
  }

  if (covered) redirect("/app?nouveau=1");
  const result = await checkoutDestination(user.id, choice);
  if ("covered" in result) redirect("/app?nouveau=1");
  if ("error" in result) return { message: `${result.error} Ton arc est enregistré : tu pourras le lancer depuis la page des plans.` };
  redirect(result.url);
}
