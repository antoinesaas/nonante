import type { Locale } from "@/lib/i18n/config";
import { de } from "@/lib/i18n/messages/de";
import { en } from "@/lib/i18n/messages/en";
import { es } from "@/lib/i18n/messages/es";
import { fr } from "@/lib/i18n/messages/fr";

export type Messages = typeof fr;

const ALL: Record<Locale, Messages> = { fr, en, de, es };

export function getMessages(locale: Locale): Messages {
  return ALL[locale];
}
