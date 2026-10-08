"use client";

import { useI18n } from "@/components/I18nProvider";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { m } = useI18n();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-5">
      <h1 className="font-serif text-5xl leading-none">{m.common.errorPage.title}</h1>
      <p className="mt-6 text-mute">{m.common.errorPage.text}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-10 h-12 w-fit rounded-xs border border-paper px-6 text-paper transition-colors hover:bg-paper hover:text-ink"
      >
        {m.common.actions.retry}
      </button>
    </main>
  );
}
