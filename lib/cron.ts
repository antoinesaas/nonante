import "server-only";
import { sendArcResult, sendLoyalty, sendReminder, sendWeeklyRecap } from "@/lib/emails";
import { removeProofPhotos } from "@/lib/photos";
import { plural } from "@/lib/proofs";
import { sendPush } from "@/lib/push";
import { stripeConfigured } from "@/lib/stripe";
import { applyLoyaltyDiscount } from "@/lib/stripe-codes";
import { createAdminClient } from "@/lib/supabase/admin";

// Tâches planifiées (§13). Toutes idempotentes et tolérantes à un retard : le travail fait est noté en base.

type Admin = ReturnType<typeof createAdminClient>;

function parisClock(now = new Date()): { hour: number; isodow: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return {
    hour: Number(get("hour")),
    isodow: days.indexOf(get("weekday")) + 1,
    date: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

async function call<T>(admin: Admin, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  // Les noms de fonctions sont fixes dans ce fichier : le typage précis n'apporte rien ici.
  const { data, error } = await (admin.rpc as unknown as (f: string, a: object) => Promise<{ data: T; error: { code?: string } | null }>)(fn, args);
  if (error) throw new Error(`${fn} : ${error.code ?? "erreur"}`);
  return data;
}

/** 00 h 05 : clôture des jours (pénalités, jamais deux fois, jours blancs, jokers, semaines, quêtes, succès, fin d'arc). */
export async function taskDayClose(admin = createAdminClient()) {
  return { closed: await call<number>(admin, "cron_close_days") };
}

/** Contrôles non envoyés dans les 24 h : échec et pénalité. */
export async function taskAudits(admin = createAdminClient()) {
  return { expired: await call<number>(admin, "cron_expire_audits") };
}

/** Photos de plus de 30 jours, sessions abandonnées, compteurs de limitation périmés. */
export async function taskCleanup(admin = createAdminClient()) {
  const broken = await call<number>(admin, "cron_expire_sessions");
  const paths = await call<string[]>(admin, "cron_photo_cleanup_targets");
  await removeProofPhotos(paths);
  if (paths.length) await call(admin, "mark_photos_deleted", { p_paths: paths });
  await call(admin, "cleanup_rate_limits");
  return { sessions_broken: broken, photos_deleted: paths.length };
}

/** Lundi : récapitulatif des 7 derniers jours (un seul par semaine grâce à email_log). */
export async function taskWeekly(admin = createAdminClient()) {
  const monday = parisClock().date;
  const targets = await call<
    { user_id: string; email: string | null; email_reminders: boolean; points: number; green: number; days: number;
      streak: number; level: number; ovr: number }[]
  >(admin, "weekly_recap_targets");
  let recaps = 0;
  for (const t of targets) {
    if (!t.email || !t.email_reminders || t.days === 0) continue;
    const first = await call<boolean>(admin, "log_email_once", { p_user: t.user_id, p_kind: "weekly", p_ref: monday });
    if (first && (await sendWeeklyRecap(t.email, t.user_id, t))) recaps++;
  }
  return { recaps };
}

/** Le soir : un seul rappel par jour, push si possible, sinon email. */
export async function taskReminders(admin = createAdminClient()) {
  const targets = await call<
    { user_id: string; email: string | null; remaining: number; points: number; email_reminders: boolean; has_push: boolean }[]
  >(admin, "cron_reminder_targets");
  let push = 0;
  let email = 0;
  for (const t of targets) {
    const channel = t.has_push ? "push" : t.email_reminders && t.email ? "email" : "none";
    // Noter d'abord : en cas de relance, personne ne reçoit deux rappels.
    const first = await call<boolean>(admin, "mark_reminded", { p_user: t.user_id, p_channel: channel });
    if (!first) continue;
    const body = `Il te reste ${plural(t.remaining, "principe", "principes")}. ${t.points} points en jeu.`;
    if (channel === "push" && (await sendPush(t.user_id, { title: "Nonante", body, url: "/app" }))) {
      push++;
    } else if (t.email_reminders && t.email && (await sendReminder(t.email, t.user_id, t.remaining, t.points))) {
      email++;
    }
  }
  return { targets: targets.length, push, email };
}

/** Arcs tenus : −50 % sur la prochaine facture (une fois). Arcs terminés : email de bilan (une fois). */
export async function taskArcEnd(admin = createAdminClient()) {
  const loyalty = await call<{ enrollment_id: string; user_id: string; email: string | null; subscription_id: string | null; plan: string | null }[]>(
    admin,
    "cron_loyalty_targets",
  );
  let applied = 0;
  for (const l of loyalty) {
    let ok = false;
    if (l.subscription_id && l.plan !== "fondateur" && stripeConfigured()) {
      try {
        ok = await applyLoyaltyDiscount(l.subscription_id);
      } catch (e) {
        console.error(`[cron] remise de fidélité impossible : ${e instanceof Error ? e.message : "erreur"}`);
        continue;
      }
    }
    await call(admin, "mark_loyalty_applied", { p_enrollment: l.enrollment_id });
    if (ok) applied++;
    if (l.email) {
      const first = await call<boolean>(admin, "log_email_once", { p_user: l.user_id, p_kind: "loyalty", p_ref: l.enrollment_id });
      if (first) await sendLoyalty(l.email, ok);
    }
  }

  const results = await call<{ enrollment_id: string; user_id: string; email: string | null; status: string; green: number }[]>(admin, "cron_arc_results");
  let emails = 0;
  for (const r of results) {
    if (!r.email || r.status !== "failed") continue;
    const first = await call<boolean>(admin, "log_email_once", { p_user: r.user_id, p_kind: "arc_result", p_ref: r.enrollment_id });
    if (first && (await sendArcResult(r.email, r.green))) emails++;
  }
  return { loyalty: loyalty.length, discounts: applied, result_emails: emails };
}

/** Une seule route pour les plans Vercel limités : exécute tout ce qui est dû. */
export async function runDue() {
  const admin = createAdminClient();
  const clock = parisClock();
  const report: Record<string, unknown> = {};

  const rate = Number(process.env.AUDIT_RATE ?? "0.10");
  if (Number.isFinite(rate) && rate >= 0 && rate <= 1) await call(admin, "set_audit_rate", { p_rate: rate });

  report.cleanup = await taskCleanup(admin);
  report.dayClose = await taskDayClose(admin);
  report.audits = await taskAudits(admin);
  report.arcEnd = await taskArcEnd(admin);
  if (clock.isodow === 1 && clock.hour < 12) report.weekly = await taskWeekly(admin);
  if (clock.hour >= 18 && clock.hour < 22) report.reminders = await taskReminders(admin);
  return report;
}
