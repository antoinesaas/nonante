import { formatEuros } from "@/lib/money";
import type { Interval, PlanId, PublicPlans } from "@/lib/types";

export const PLAN_NAME: Record<PlanId, string> = {
  arc: "Arc 90 jours",
  pro: "Pro",
  fondateur: "Fondateur",
};

export const PLAN_PITCH: Record<PlanId, string> = {
  arc: "Ton arc, construit pour ton objectif. Un seul paiement.",
  pro: "Pour ceux qui construisent un business.",
  fondateur: "Pro, à vie. Pour les 100 premiers.",
};

export const PLAN_FEATURES: Record<PlanId, string[]> = {
  arc: [
    "90 jours, à partir du jour 1 que tu choisis",
    "6 principes construits pour ton objectif, modifiables",
    "Toutes les preuves : caméra, minuteur, réveil, photo",
    "Stats de joueur, niveaux, succès, quêtes",
    "Classement et escouades",
    "1 joker",
    "Pas d'abonnement : rien ne se renouvelle tout seul",
  ],
  pro: [
    "Tout l'Arc 90 jours, arc après arc",
    "Jusqu'à 12 principes",
    "Portefeuille : tes revenus prouvés, ton objectif",
    "Crée tes escouades",
    "3 jokers par arc",
    "Historique de tous tes arcs",
  ],
  fondateur: [
    "Tout Pro, à vie",
    "Un seul paiement",
    "Badge Fondateur sur ton profil",
  ],
};

/** Prix affiché : « 19,99 € pour 90 jours », « 14,99 € / mois », « 99,99 € / an », « 199 € une fois ». */
export function priceLabel(cents: number, interval: Interval): string {
  const amount = formatEuros(cents);
  if (interval === "once") return `${amount} pour 90 jours`;
  return interval === "month" ? `${amount} / mois` : interval === "year" ? `${amount} / an` : `${amount} une fois`;
}

/** Prix par jour d'un arc de 90 jours : « 0,22 € ». */
export function perDay(cents: number): string {
  return formatEuros(Math.round(cents / 90));
}

/** Équivalent mensuel d'un prix annuel. */
export function monthlyEquivalent(yearCents: number): string {
  return formatEuros(Math.round(yearCents / 12));
}

/** Économie de l'annuel par rapport au mensuel, en pourcentage arrondi. */
export function yearlySaving(monthCents: number, yearCents: number): number {
  return Math.round((1 - yearCents / (monthCents * 12)) * 100);
}

export function fondateurLeft(plans: PublicPlans): number {
  return Math.max(0, plans.fondateur.limit - plans.fondateur.sold);
}
