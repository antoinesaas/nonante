import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { INTL, type Locale } from "@/lib/i18n/config";
import { fmt, signed } from "@/lib/i18n/format";
import { getMessages } from "@/lib/i18n/messages";

// Emails : texte sobre, une seule action par email, lien de désinscription des rappels, dans la langue du joueur.

function unsubscribeToken(userId: string): string {
  return createHmac("sha256", process.env.CRON_SECRET ?? "nonante-dev").update(`unsubscribe:${userId}`).digest("hex").slice(0, 32);
}

export function unsubscribeUrl(userId: string): string {
  return `${siteUrl()}/api/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`;
}

export function verifyUnsubscribe(userId: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function compose(locale: Locale, lines: string[], userId?: string): string {
  const e = getMessages(locale).emails;
  const footer = ["", e.signature, ...(userId ? ["", fmt(e.unsubscribe, { url: unsubscribeUrl(userId) })] : [])];
  return [...lines, ...footer].join("\n");
}

export function sendWelcome(to: string, locale: Locale) {
  const e = getMessages(locale).emails.welcome;
  return sendEmail({ to, subject: e.subject, text: compose(locale, [e.body, "", `${siteUrl()}/app`]) });
}

export function sendReminder(to: string, userId: string, remaining: number, points: number, locale: Locale) {
  const e = getMessages(locale).emails.reminder;
  return sendEmail({
    to,
    subject: fmt(e.subject, { n: remaining }, locale),
    text: compose(locale, [fmt(e.body, { n: remaining, points }, locale), "", `${siteUrl()}/app`], userId),
  });
}

/** Texte de la notification du rappel du soir. */
export function reminderPush(remaining: number, points: number, locale: Locale): string {
  return fmt(getMessages(locale).emails.reminder.push, { n: remaining, points }, locale);
}

export function sendAuditRequest(to: string, auditId: string, dueAt: string, label: string | null, locale: Locale) {
  const e = getMessages(locale).emails.audit;
  const due = new Intl.DateTimeFormat(INTL[locale], { timeZone: "Europe/Paris", weekday: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(dueAt));
  return sendEmail({
    to,
    subject: e.subject,
    text: compose(locale, [label ? fmt(e.labelled, { label }) : e.generic, fmt(e.body, { due }), "", `${siteUrl()}/app/controle/${auditId}`]),
  });
}

export function sendWeeklyRecap(
  to: string,
  userId: string,
  recap: { points: number; green: number; days: number; streak: number; level: number; ovr: number },
  locale: Locale,
) {
  const e = getMessages(locale).emails.weekly;
  return sendEmail({
    to,
    subject: fmt(e.subject, { green: recap.green, days: recap.days }),
    text: compose(
      locale,
      [
        fmt(e.points, { points: signed(recap.points) }),
        fmt(e.days, { green: recap.green, days: recap.days, streak: recap.streak }, locale),
        fmt(e.level, { level: recap.level, ovr: recap.ovr }),
        "",
        e.reset,
        "",
        `${siteUrl()}/app`,
      ],
      userId,
    ),
  });
}

/** applied : remise posée sur l'abonnement Pro ; sinon elle attend le prochain Arc 90 jours. */
export function sendLoyalty(to: string, applied: boolean, locale: Locale) {
  const e = getMessages(locale).emails.loyalty;
  return sendEmail({ to, subject: e.subject, text: compose(locale, [e.body, "", applied ? e.applied : e.pending, "", `${siteUrl()}/app`]) });
}

export function sendArcResult(to: string, green: number, locale: Locale) {
  const e = getMessages(locale).emails.result;
  return sendEmail({ to, subject: e.subject, text: compose(locale, [fmt(e.body, { green }, locale), "", `${siteUrl()}/app`]) });
}

/** Parrainage : un ami a payé. onSubscription : remise posée sur la facture Pro, sinon gardée pour le prochain arc. */
export function sendReferralReward(to: string, onSubscription: boolean, locale: Locale) {
  const e = getMessages(locale).emails.referral;
  return sendEmail({
    to,
    subject: e.subject,
    text: compose(locale, [e.body, onSubscription ? e.subscription : e.nextArc, "", `${siteUrl()}/app/profil`]),
  });
}
