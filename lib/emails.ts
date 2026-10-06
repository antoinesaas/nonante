import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
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

export function sendWelcome(to: string) {
  return sendEmail({
    to,
    subject: "Ton arc est lancé.",
    text: [
      "Ton abonnement est actif. Ton arc de 90 jours est lancé.",
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
  recap: { points: number; green: number; days: number; streak: number; level: number; ovr: number },
) {
  return sendEmail({
    to,
    subject: `Semaine écoulée : ${recap.green} jours verts sur ${recap.days}.`,
    text: [
      `${recap.points > 0 ? "+" : ""}${recap.points} points en 7 jours.`,
      `${recap.green} jours verts sur ${recap.days}. Série en cours : ${plural(recap.streak, "jour", "jours")}.`,
      `Niveau ${recap.level}, note globale ${recap.ovr}.`,
      "",
      "Le classement de la semaine repart de zéro aujourd'hui.",
      "",
      `${siteUrl()}/app`,
      ...withUnsubscribe(userId),
    ].join("\n"),
  });
}

export function sendLoyalty(to: string, applied: boolean) {
  return sendEmail({
    to,
    subject: "Arc tenu.",
    text: [
      "Tu as tenu ton arc. 90 jours, prouvés.",
      "",
      applied
        ? "Merci : ta prochaine facture est à −50 %. Rien à faire, la remise est déjà appliquée."
        : "Ton prochain arc t'attend dans l'app.",
      "",
      `${siteUrl()}/app`,
      ...signature,
    ].join("\n"),
  });
}

export function sendArcResult(to: string, green: number) {
  return sendEmail({
    to,
    subject: "Ton arc est terminé.",
    text: [
      `Ton arc est terminé : ${plural(green, "jour vert", "jours verts")} sur 90.`,
      "Il en fallait 75, sans plus de 3 jours non verts d'affilée.",
      "",
      "Le prochain arc commence quand tu veux.",
      "",
      `${siteUrl()}/app`,
      ...signature,
    ].join("\n"),
  });
}

export function sendReferralCredit(to: string, cents: number) {
  return sendEmail({
    to,
    subject: "Quelqu'un a rejoint Nonante grâce à toi.",
    text: [
      `Ton code de parrainage a servi. ${formatEuros(cents)} de crédit sont ajoutés à ton abonnement.`,
      "Ils seront déduits de ta prochaine facture.",
      "",
      `${siteUrl()}/app/profil`,
      ...signature,
    ].join("\n"),
  });
}
