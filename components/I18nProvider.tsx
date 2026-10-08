"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";

const I18nContext = createContext<{ locale: Locale; m: Messages } | null>(null);

/** Donne la langue et les textes aux composants client (posé une fois dans la mise en page racine). */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, m: messages }}>{children}</I18nContext.Provider>;
}

export function useI18n(): { locale: Locale; m: Messages } {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider manquant");
  return value;
}
