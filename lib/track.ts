import { track } from "@vercel/analytics";

/**
 * Évènement de parcours pour Vercel Web Analytics (onglet « Events ») : écran du questionnaire, plan choisi, paiement
 * lancé, session de minuteur… Jamais de donnée personnelle : seulement des noms d'écran, de plan, de durée.
 * Les évènements personnalisés ne s'affichent qu'avec un compte Vercel Pro ; sans lui, ils sont ignorés.
 */
export function trackEvent(name: string, props?: Record<string, string | number | boolean | null>) {
  try {
    track(name, props);
  } catch {
    // Mesure indisponible (bloqueur, local) : sans conséquence.
  }
}
