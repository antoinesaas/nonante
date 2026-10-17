"use client";

import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { useI18n } from "@/components/I18nProvider";
import { ShareProfileButton } from "@/components/ShareProfileButton";
import { Sheet } from "@/components/Sheet";

/** Parrainage replié dans une ligne : le code, la copie et le partage s'ouvrent dans une feuille. */
export function ReferralRow({ code, link, shareUrl }: { code: string; link: string; shareUrl: string | null }) {
  const { m } = useI18n();
  const t = m.app.today;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-white/[0.04]">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px]">{t.referralRow}</span>
          <span className="block text-[13px] text-mute">{t.referralRowHint}</span>
        </span>
        <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-mute" aria-hidden="true">
          <path d="M6 3.5 L10.5 8 L6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.referral}>
        <p className="text-sm text-mute">{t.referralText}</p>
        <div className="glow-violet mt-5 flex items-center justify-between gap-4 rounded-3xl p-5">
          <span className="font-display text-[26px] tracking-tight">{code}</span>
          <CopyButton value={`${code} · ${link}`} label={t.copy} />
        </div>
        {shareUrl ? <ShareProfileButton url={shareUrl} code={code} className="mt-4" /> : null}
        <div className="h-4" />
      </Sheet>
    </>
  );
}
