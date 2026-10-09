import "server-only";
import { sendArcResult, sendLoyalty } from "@/lib/emails";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { localesOf } from "@/lib/i18n/user";
import { removeProofPhotos } from "@/lib/photos";
import { stripeConfigured } from "@/lib/stripe";
import { applyLoyaltyDiscount } from "@/lib/stripe-codes";
import { createAdminClient } from "@/lib/supabase/admin";

// Tâches planifiées (§13). Toutes idempotentes et tolérantes à un retard : le travail fait est noté en base.

type Admin = ReturnType<typeof createAdminClient>;

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

/** Arcs tenus : −50 % sur la prochaine facture Pro ou le prochain Arc 90 jours (une fois). Arcs terminés : email de bilan (une fois). */
export async function taskArcEnd(admin = createAdminClient()) {
  const loyalty = await call<{ enrollment_id: string; user_id: string; email: string | null; subscription_id: string | null; plan: string | null }[]>(
    admin,
    "cron_loyalty_targets",
  );
  const results = await call<{ enrollment_id: string; user_id: string; email: string | null; status: string; green: number }[]>(admin, "cron_arc_results");
  const locales = await localesOf(admin, [...loyalty.map((l) => l.user_id), ...results.map((r) => r.user_id)]);
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
    // Pas d'abonnement à remiser (Arc 90 jours) : −50 % sur le prochain Arc 90 jours. Fondateur : rien à payer.
    const pending = !ok && l.plan !== "fondateur";
    await call(admin, "mark_loyalty_applied", { p_enrollment: l.enrollment_id, p_pending: pending });
    if (ok || pending) applied++;
    if (l.email) {
      const first = await call<boolean>(admin, "log_email_once", { p_user: l.user_id, p_kind: "loyalty", p_ref: l.enrollment_id });
      if (first && (ok || pending)) await sendLoyalty(l.email, ok, locales.get(l.user_id) ?? DEFAULT_LOCALE);
    }
  }

  let emails = 0;
  for (const r of results) {
    if (!r.email || r.status !== "failed") continue;
    const first = await call<boolean>(admin, "log_email_once", { p_user: r.user_id, p_kind: "arc_result", p_ref: r.enrollment_id });
    if (first && (await sendArcResult(r.email, r.green, locales.get(r.user_id) ?? DEFAULT_LOCALE))) emails++;
  }
  return { loyalty: loyalty.length, discounts: applied, result_emails: emails };
}

/** Une seule route pour les plans Vercel limités : exécute tout ce qui est dû. */
export async function runDue() {
  const admin = createAdminClient();
  const report: Record<string, unknown> = {};

  const rate = Number(process.env.AUDIT_RATE ?? "0.10");
  if (Number.isFinite(rate) && rate >= 0 && rate <= 1) await call(admin, "set_audit_rate", { p_rate: rate });

  report.cleanup = await taskCleanup(admin);
  report.dayClose = await taskDayClose(admin);
  report.audits = await taskAudits(admin);
  report.arcEnd = await taskArcEnd(admin);
  return report;
}
