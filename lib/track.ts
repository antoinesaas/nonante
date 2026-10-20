import { track } from "@vercel/analytics";

// Identifiant de visite tiré au hasard à chaque chargement de page, gardé en mémoire seulement (ni cookie, ni
// stockage) : il relie les écrans d'un même questionnaire, rien de plus.
const visit = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "").slice(0, 24) : Math.random().toString(36).slice(2, 14);

/**
 * Évènement de parcours : écran du questionnaire, plan choisi, paiement lancé, session de minuteur, calcul mental.
 * Enregistré chez Nonante (table analytics_events, page /admin/entonnoir) et envoyé à Vercel Web Analytics (visible
 * seulement avec un compte Pro). Jamais de donnée personnelle : des noms d'écran, de plan, des durées.
 */
export function trackEvent(name: string, props?: Record<string, string | number | boolean | null>) {
  try {
    track(name, props);
  } catch {
    // Vercel indisponible (bloqueur, local) : sans conséquence.
  }
  try {
    const body = JSON.stringify({
      visit,
      name,
      props: props ?? {},
      path: window.location.pathname,
      device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
    });
    if (!navigator.sendBeacon?.("/api/track", body)) void fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    // Mesure indisponible : sans conséquence.
  }
}
