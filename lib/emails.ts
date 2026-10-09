import "server-only";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { INTL, type Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import { getMessages } from "@/lib/i18n/messages";

// Emails : texte sobre, une seule action par email, dans la langue du joueur. Aucun rappel ni récapitulatif.

function compose(locale: Locale, lines: string[]): string {
  return [...lines, "", getMessages(locale).emails.signature].join("\n");
}

export function sendWelcome(to: string, locale: Locale) {
  const e = getMessages(locale).emails.welcome;
  return sendEmail({ to, subject: e.subject, text: compose(locale, [e.body, "", `${siteUrl()}/app`]) });
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
