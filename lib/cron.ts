import "server-only";
import { sendArcResult, sendLoyalty, sendReminder, sendWeeklyRecap } from "@/lib/emails";
import { removeProofPhotos } from "@/lib/photos";
import { plural } from "@/lib/proofs";
import { sendPush } from "@/lib/push";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createLoyaltyCode } from "@/lib/stripe-codes";
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

/** 00 h 05 : clôture des jours (pénalités, jamais deux fois, jours blancs, semaine parfaite, succès, abandons). */
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

/** Lundi : épreuves jugées, montées de niveau, épreuve de la semaine, récapitulatif court. */
export async function taskWeekly(admin = createAdminClient(), { recap }: { recap: boolean }) {
  const weekly = await call<{ evaluated: number; level_ups: number }>(admin, "cron_weekly");
  let recaps = 0;
  if (recap) {
    const monday = parisClock().date;
    const targets = await call<
      { user_id: string; email: string | null; email_reminders: boolean; points: number; green: number; days: number;
        challenge: string | null; challenge_status: string | null }[]
    >(admin, "weekly_recap_targets");
    for (const t of targets) {
      if (!t.email || !t.email_reminders || t.days === 0) continue;
      const first = await call<boolean>(admin, "log_email_once", { p_user: t.user_id, p_kind: "weekly", p_ref: monday });
      if (first && (await sendWeeklyRecap(t.email, t.user_id, t))) recaps++;
    }
  }
  return { ...weekly, recaps };
}

/** 18 h 30 : un seul rappel par jour, push si possible, sinon email. */
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

/** Clôture des cohortes : arcs tenus (codes fidélité, mises remboursées) et ratés (bilan). */
export async function taskCohortEnd(admin = createAdminClient()) {
  const result = await call<{
    completed: { enrollment_id: string; user_id: string; email: string | null; cohort: string; stake_payment_intent_id: string | null }[];
    failed: { enrollment_id: string; user_id: string; email: string | null; cohort: string; green: number }[];
  }>(admin, "cron_cohort_end");

  let loyalty = 0;
  let refunds = 0;
  for (const c of result.completed) {
    if (stripeConfigured()) {
      try {
        const first = await call<boolean>(admin, "log_email_once", { p_user: c.user_id, p_kind: "loyalty", p_ref: c.enrollment_id });
        if (first) {
          const code = await createLoyaltyCode(c.user_id, c.enrollment_id);
          await call(admin, "set_loyalty_code", { p_enrollment: c.enrollment_id, p_code: code });
          if (c.email) await sendLoyalty(c.email, c.cohort, code);
          loyalty++;
        }
      } catch (e) {
        console.error(`[cron] code fidélité impossible : ${e instanceof Error ? e.message : "erreur"}`);
      }
      // Mise sur soi : remboursée intégralement à qui tient son arc.
      if (c.stake_payment_intent_id) {
        try {
          await getStripe().refunds.create(
            { payment_intent: c.stake_payment_intent_id },
            { idempotencyKey: `stake-refund-${c.enrollment_id}` },
          );
          await call(admin, "mark_stake", { p_enrollment: c.enrollment_id, p_status: "refunded" });
          refunds++;
        } catch (e) {
          console.error(`[cron] remboursement de mise impossible : ${e instanceof Error ? e.message : "erreur"}`);
        }
      }
    }
  }
  for (const f of result.failed) {
    if (!f.email) continue;
    const first = await call<boolean>(admin, "log_email_once", { p_user: f.user_id, p_kind: "arc_result", p_ref: f.enrollment_id });
    if (first) await sendArcResult(f.email, f.cohort, f.green);
  }
  return { completed: result.completed.length, failed: result.failed.length, loyalty, refunds };
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
  report.cohortEnd = await taskCohortEnd(admin);
  report.weekly = await taskWeekly(admin, { recap: clock.isodow === 1 && clock.hour < 12 });
  if (clock.hour >= 18 && clock.hour < 22) report.reminders = await taskReminders(admin);
  return report;
}
