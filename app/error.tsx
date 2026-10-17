"use client";

import { Aura } from "@/components/Aura";
import { useI18n } from "@/components/I18nProvider";
import { btnPrimary } from "@/lib/ui";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { m } = useI18n();
  return (
    <main className="relative isolate mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center overflow-x-clip px-5">
      <Aura tone="amber" />
      <h1 className="font-display text-[40px] leading-[1.02]">{m.common.errorPage.title}</h1>
      <p className="mt-4 text-mute">{m.common.errorPage.text}</p>
      <button type="button" onClick={reset} className={`${btnPrimary} mt-8`}>
        {m.common.actions.retry}
      </button>
    </main>
  );
}
