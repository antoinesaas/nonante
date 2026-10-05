import "server-only";
import { Resend } from "resend";

type Email = { to: string; subject: string; text: string };

/**
 * Envoie un email texte sobre via Resend. Renvoie false sans lever d'erreur si
 * Resend n'est pas configuré ou si l'envoi échoue : un email manqué ne doit
 * jamais faire échouer un paiement. Aucune donnée personnelle dans les logs.
 */
export async function sendEmail({ to, subject, text }: Email): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[email] Resend non configuré : email non envoyé.");
    return false;
  }

  const { error } = await new Resend(apiKey).emails.send({ from, to, subject, text });
  if (error) {
    console.error(`[email] échec de l'envoi : ${error.name}`);
    return false;
  }
  return true;
}
