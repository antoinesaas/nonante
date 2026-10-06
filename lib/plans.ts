import { formatEuros } from "@/lib/money";
import type { Interval, PlanId, PublicPlans } from "@/lib/types";

export const PLAN_NAME: Record<PlanId, string> = {
  essentiel: "Essentiel",
  pro: "Pro",
  fondateur: "Fondateur",
};

export const PLAN_PITCH: Record<PlanId, string> = {
  essentiel: "Tout pour tenir 90 jours.",
  pro: "Pour ceux qui construisent un business.",
  fondateur: "Pro, à vie. Pour les 100 premiers.",
};

export const PLAN_FEATURES: Record<PlanId, string[]> = {
  essentiel: [
    "Ton arc de 90 jours, quand tu veux",
    "Jusqu'à 6 principes personnalisés",
    "Toutes les preuves : caméra, minuteur, réveil, photo",
    "Stats de joueur, niveaux, succès",
    "Classement et escouades",
    "1 joker par arc",
  ],
  pro: [
    "Tout Essentiel",
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

/** Prix affiché : « 7,99 € / mois », « 59,99 € / an », « 199 € une fois ». */
export function priceLabel(cents: number, interval: Interval): string {
  const amount = formatEuros(cents);
  return interval === "month" ? `${amount} / mois` : interval === "year" ? `${amount} / an` : `${amount} une fois`;
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
