import type { PublicPlans } from "@/lib/types";

/** Économie de l'annuel par rapport au mensuel, en pourcentage arrondi. */
export function yearlySaving(monthCents: number, yearCents: number): number {
  return Math.round((1 - yearCents / (monthCents * 12)) * 100);
}

export function fondateurLeft(plans: PublicPlans): number {
  return Math.max(0, plans.fondateur.limit - plans.fondateur.sold);
}
