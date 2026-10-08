import type { Locale } from "@/lib/i18n/config";
import { de } from "@/lib/legal-docs/de";
import { en } from "@/lib/legal-docs/en";
import { es } from "@/lib/legal-docs/es";
import { fr } from "@/lib/legal-docs/fr";
import type { LegalSet } from "@/lib/legal-docs/types";

const ALL: Record<Locale, LegalSet> = { fr, en, de, es };

export function legalDocs(locale: Locale): LegalSet {
  return ALL[locale];
}
