"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { type ActionResult, userMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { ensureReferralCode } from "@/lib/stripe-codes";

export type OnboardingState = { message: string | null };

const Answers = z.object({
  pseudo: z.string().max(40),
  birthYear: z.coerce.number().int().min(1900).max(2100),
  isPublic: z.boolean(),
  adult: z.boolean(),
  category: z.enum(["etudes", "business", "mixte"], { error: "Choisis une catégorie." }),
  goal: z.string().trim().min(3, { error: "Ton objectif : au moins 3 caractères." }).max(120),
  goalPublic: z.boolean(),
  weakMoments: z.array(z.enum(["soir", "weekend", "fatigue", "commencer", "personne"])).max(5),
  wakeTime: z.string().regex(/^([01]\d|2[0-3]):(00|30)$/, { error: "Heure de lever invalide." }),
  pushups: z.enum(["oui", "quelques", "non"], { error: "Réponds à la question sur les pompes." }),
  cohortId: z.uuid().nullable(),
});

/** Crée le profil et l'inscription ; les principes sont générés côté serveur (gabarits imposés). */
export async function createEnrollment(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login?next=/onboarding");

  const parsed = Answers.safeParse({
    pseudo: String(formData.get("pseudo") ?? ""),
    birthYear: formData.get("birthYear") || 0,
    isPublic: formData.get("isPublic") === "oui",
    adult: formData.get("adult") === "on",
    category: formData.get("category"),
    goal: String(formData.get("goal") ?? ""),
    goalPublic: formData.get("goalPublic") === "oui",
    weakMoments: formData.getAll("weakMoments").map(String),
    wakeTime: String(formData.get("wakeTime") ?? ""),
    pushups: formData.get("pushups"),
    cohortId: formData.get("cohortId") ? String(formData.get("cohortId")) : null,
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Réponses incomplètes." };
  if (!(await rateLimit("onboarding", 10, 600))) return { message: "Trop de tentatives. Réessaie dans quelques minutes." };

  const a = parsed.data;
  const { error } = await supabase.rpc("create_enrollment", {
    p_pseudo: a.pseudo,
    p_birth_year: a.birthYear,
    p_is_public: a.isPublic,
    p_adult: a.adult,
    p_category: a.category,
    p_goal_title: a.goal,
    p_goal_public: a.goalPublic,
    p_weak_moments: a.weakMoments,
    p_wake_time: a.wakeTime,
    p_pushups: a.pushups,
    p_cohort_id: a.cohortId,
  });
  if (error) return { message: userMessage(error) };

  // Code de parrainage personnel (sans bloquer l'onboarding si Stripe est indisponible).
  const { data: profile } = await supabase.from("profiles").select("referral_code, stripe_promotion_code_id").eq("id", user.id).single();
  if (profile?.referral_code && !profile.stripe_promotion_code_id) {
    try {
      await ensureReferralCode(user.id, profile.referral_code);
    } catch (e) {
      console.error(`[onboarding] code de parrainage non créé : ${e instanceof Error ? e.name : "erreur"}`);
    }
  }
  redirect("/onboarding/principes");
}

export async function setCustomPrinciple(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, message: "Connecte-toi." };
  const { error } = await supabase.rpc("set_custom_principle", {
    p_if: String(formData.get("if") ?? "").slice(0, 200),
    p_then: String(formData.get("then") ?? "").slice(0, 200),
  });
  if (error) return { ok: false, message: userMessage(error) };
  revalidatePath("/onboarding/principes");
  return { ok: true, message: "Principe ajouté." };
}

export async function removeCustomPrinciple(): Promise<void> {
  const { supabase, user } = await getUser();
  if (!user) return;
  await supabase.rpc("remove_custom_principle");
  revalidatePath("/onboarding/principes");
}
