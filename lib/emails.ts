import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { formatDayFr } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { formatEuros } from "@/lib/money";
import { plural } from "@/lib/proofs";

// Emails : texte sobre, une seule action par email, lien de désinscription des rappels.

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

const signature = ["", "Nonante"];
const withUnsubscribe = (userId: string) => [...signature, "", `Ne plus recevoir les rappels : ${unsubscribeUrl(userId)}`];

export function sendWelcome(to: string, cohort: { name: string; start_date: string }) {
  return sendEmail({
    to,
    subject: "Tu es inscrit.",
    text: [
      `Ta place est confirmée : ${cohort.name}.`,
      `Départ : ${formatDayFr(cohort.start_date, { weekday: true })}.`,
      "",
      "Tes principes t'attendent. Rien ne se valide sans preuve.",
      "",
      `${siteUrl()}/app`,
      ...signature,
    ].join("\n"),
  });
}

export function sendReminder(to: string, userId: string, remaining: number, points: number) {
  return sendEmail({
    to,
    subject: `Il te reste ${plural(remaining, "principe", "principes")}.`,
    text: [
      `Il te reste ${plural(remaining, "principe", "principes")} à prouver aujourd'hui. ${points} points en jeu.`,
      "Minuit, heure de Paris : après, c'est trop tard.",
      "",
      `${siteUrl()}/app`,
      ...withUnsubscribe(userId),
    ].join("\n"),
  });
}

export function sendAuditRequest(to: string, auditId: string, dueAt: string, label: string | null) {
  const due = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dueAt));
  return sendEmail({
    to,
    subject: "Contrôle : envoie ta preuve.",
    text: [
      label ? `Ta validation « ${label} » est contrôlée.` : "Une de tes validations est contrôlée.",
      `Envoie une photo de ta preuve avant ${due}. Sans réponse, la pénalité est lourde.`,
      "",
      `${siteUrl()}/app/controle/${auditId}`,
      ...signature,
    ].join("\n"),
  });
}

export function sendWeeklyRecap(
  to: string,
  userId: string,
  recap: { points: number; green: number; days: number; challenge: string | null; challenge_status: string | null },
) {
  const challenge = recap.challenge
    ? `Épreuve : ${recap.challenge} ${recap.challenge_status === "done" ? "Réussie." : recap.challenge_status === "failed" ? "Ratée." : ""}`
    : null;
  return sendEmail({
    to,
    subject: `Semaine écoulée : ${recap.green} jours verts sur ${recap.days}.`,
    text: [
      `${recap.points > 0 ? "+" : ""}${recap.points} points cette semaine.`,
      `${recap.green} jours verts sur ${recap.days}.`,
      ...(challenge ? [challenge] : []),
      "",
      "Le classement de la semaine repart de zéro aujourd'hui.",
      "",
      `${siteUrl()}/app`,
      ...withUnsubscribe(userId),
    ].join("\n"),
  });
}

export function sendLoyalty(to: string, cohort: string, code: string) {
  return sendEmail({
    to,
    subject: "Arc tenu.",
    text: [
      `Tu as tenu ${cohort}. 90 jours, prouvés.`,
      "",
      `Pour le prochain arc, ce code donne −50 % : ${code}`,
      "Il ne sert qu'une fois.",
      "",
      siteUrl(),
      ...signature,
    ].join("\n"),
  });
}

export function sendArcResult(to: string, cohort: string, green: number) {
  return sendEmail({
    to,
    subject: "L'arc est terminé.",
    text: [
      `${cohort} est terminé. ${plural(green, "jour vert", "jours verts")} sur 90.`,
      "Il en fallait 75, sans plus de 3 jours non verts d'affilée.",
      "",
      "Le prochain arc t'attend.",
      "",
      siteUrl(),
      ...signature,
    ].join("\n"),
  });
}

export function sendPresaleConfirmation(
  to: string,
  cohort: { name: string; start_date: string; end_date: string },
  amountCents: number,
) {
  return sendEmail({
    to,
    subject: "Ta place est réservée.",
    text: [
      `Ta place est réservée : ${cohort.name}.`,
      "",
      `Départ : ${formatDayFr(cohort.start_date, { weekday: true })}.`,
      `Fin : ${formatDayFr(cohort.end_date, { weekday: true })}.`,
      `Montant payé : ${formatEuros(amountCents)}.`,
      "",
      "Crée ton compte avec cette adresse email : ta place y sera rattachée.",
      "",
      `${siteUrl()}/login`,
      ...signature,
    ].join("\n"),
  });
}
