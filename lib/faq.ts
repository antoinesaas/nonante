import type { Messages } from "@/lib/i18n/messages";

export type FaqItem = { id: string; q: string; a: string };

/** Questions choisies par identifiant (extraits sur la landing, les plans et le questionnaire). */
export function faqItems(ids: string[], m: Messages): FaqItem[] {
  const all = m.faq.groups.flatMap((g) => g.items);
  return ids.map((id) => all.find((i) => i.id === id)).filter((i): i is FaqItem => Boolean(i));
}

/** Questions sur les prix (page des plans). */
export function pricingFaq(m: Messages): FaqItem[] {
  return faqItems(["payant", "choisir", "renouvellement", "parrainage", "retractation", "remises", "classement-argent"], m);
}
