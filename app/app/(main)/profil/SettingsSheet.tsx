"use client";

import Link from "next/link";
import { useState } from "react";
import { DeleteAccountForm } from "@/app/app/(main)/profil/DeleteAccountForm";
import { InstallHint } from "@/app/app/(main)/profil/InstallHint";
import { SettingsForm } from "@/app/app/(main)/profil/SettingsForm";
import { useI18n } from "@/components/I18nProvider";
import { Sheet } from "@/components/Sheet";
import { fmt } from "@/lib/i18n/format";
import { btnSecondary, label } from "@/lib/ui";

type Props = { isPublic: boolean; walletPublic: boolean; bio: string | null; email: string; isAdmin: boolean; pseudo: string };

/** Roue dentée du profil : réglages, données (export, déconnexion, suppression) et installation, dans une feuille. */
export function SettingsSheet({ isPublic, walletPublic, bio, email, isAdmin, pseudo }: Props) {
  const { m } = useI18n();
  const t = m.app.profile;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.settings}
        className="-mr-2 grid size-11 place-items-center rounded-full text-mute transition-[color,transform] duration-150 hover:text-paper active:scale-90"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3.1" />
          <path d="M12 2.75 L13.6 2.95 L14.2 5.3 L15.6 5.9 L17.7 4.65 L19.35 6.3 L18.1 8.4 L18.7 9.8 L21.05 10.4 L21.25 12 L21.05 13.6 L18.7 14.2 L18.1 15.6 L19.35 17.7 L17.7 19.35 L15.6 18.1 L14.2 18.7 L13.6 21.05 L12 21.25 L10.4 21.05 L9.8 18.7 L8.4 18.1 L6.3 19.35 L4.65 17.7 L5.9 15.6 L5.3 14.2 L2.95 13.6 L2.75 12 L2.95 10.4 L5.3 9.8 L5.9 8.4 L4.65 6.3 L6.3 4.65 L8.4 5.9 L9.8 5.3 L10.4 2.95 Z" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t.settings}>
        {open ? (
          <>
            <SettingsForm isPublic={isPublic} walletPublic={walletPublic} bio={bio} />
            <section className="mt-10 border-t border-line pt-6">
              <p className={label}>{t.data}</p>
              <p className="mt-3 text-sm text-mute">{fmt(t.connectedAs, { email })}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href="/api/me/export" className={btnSecondary}>
                  {t.export}
                </a>
                <form action="/auth/signout" method="post">
                  <button type="submit" className={btnSecondary}>
                    {t.signOut}
                  </button>
                </form>
                {isAdmin ? (
                  <Link href="/admin" className={btnSecondary}>
                    {t.admin}
                  </Link>
                ) : null}
              </div>
              <DeleteAccountForm pseudo={pseudo} />
            </section>
            <InstallHint />
          </>
        ) : null}
      </Sheet>
    </>
  );
}
