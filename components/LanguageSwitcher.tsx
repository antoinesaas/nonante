"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { useI18n } from "@/components/I18nProvider";
import { LOCALE_LABEL, LOCALES } from "@/lib/i18n/config";

/** FR · EN · DE · ES : change la langue de toute l'app, sans quitter la page. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, m } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="group" aria-label={m.common.footer.language} className={`flex items-center gap-1 text-xs ${pending ? "opacity-60" : ""} ${className}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          title={LOCALE_LABEL[l]}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setLocale(l);
              router.refresh();
            })
          }
          className={`h-8 min-w-9 rounded-full px-2 uppercase tracking-wider transition-colors ${locale === l ? "bg-paper text-ink" : "text-mute hover:text-paper"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
