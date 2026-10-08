"use client";

import Image from "next/image";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { removeAvatar, setCardArt, uploadAvatar } from "@/app/actions/profile";
import { useI18n } from "@/components/I18nProvider";
import { Avatar, PlayerCard } from "@/components/Player";
import { Sheet } from "@/components/Sheet";
import { FormMessage } from "@/components/SubmitButton";
import { compressImage } from "@/lib/compress-image";
import { idle } from "@/lib/errors";
import type { Stats } from "@/lib/types";
import { btnLink } from "@/lib/ui";

type ArtOption = { slug: string; title: string; artist: string; width: number; height: number };

function Pencil({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path d="M10.5 2.5 L13.5 5.5 L5.5 13.5 L2.5 13.5 L2.5 10.5 Z M9 4 L12 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Carte du profil : toucher la photo pour la changer, crayon pour changer le fond. */
export function ProfileCard({
  pseudo,
  avatarPath,
  stats,
  art,
  founder,
  arts,
}: {
  pseudo: string;
  avatarPath: string | null;
  stats: Stats;
  art: string;
  founder: boolean;
  arts: ArtOption[];
}) {
  const { m } = useI18n();
  const t = m.app.profile;
  const file = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState(idle);
  const [sheet, setSheet] = useState(false);
  const [shownArt, setShownArt] = useOptimistic(art);

  function upload(f: File | undefined) {
    if (!f) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("avatar", await compressImage(f, 1024));
      setResult(await uploadAvatar(idle, fd));
    });
  }

  function pickArt(slug: string) {
    startTransition(async () => {
      setShownArt(slug);
      setResult(await setCardArt(slug));
    });
  }

  return (
    <div>
      <PlayerCard
        pseudo={pseudo}
        avatarPath={avatarPath}
        stats={stats}
        art={shownArt}
        founder={founder}
        avatarSlot={
          <button
            type="button"
            onClick={() => file.current?.click()}
            disabled={pending}
            aria-label={t.editPhoto}
            className="group relative shrink-0 rounded-full transition-transform active:scale-95"
          >
            <Avatar path={avatarPath} pseudo={pseudo} size={72} className={`size-18 transition-opacity ${pending ? "opacity-50" : ""}`} />
            <span className="absolute -right-0.5 -bottom-0.5 grid size-7 place-items-center rounded-full border border-ink bg-paper text-ink transition-transform group-hover:scale-110">
              <Pencil />
            </span>
          </button>
        }
        editSlot={
          <button
            type="button"
            onClick={() => setSheet(true)}
            aria-label={t.editCard}
            className="grid size-10 place-items-center rounded-full border border-line bg-ink/70 text-paper transition-[transform,border-color] hover:border-paper active:scale-95"
          >
            <Pencil className="size-4" />
          </button>
        }
      />
      <input
        ref={file}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div className="mt-3 flex min-h-6 items-center justify-between gap-3">
        <FormMessage message={result.message} ok={result.ok} />
        {avatarPath ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => setResult(await removeAvatar()))}
            className={`${btnLink} ml-auto shrink-0`}
          >
            {t.removePhoto}
          </button>
        ) : null}
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title={t.cardSheet}>
        <p className="mt-1 text-sm text-mute">{t.cardHint}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {arts.map((a) => (
            <button
              key={a.slug}
              type="button"
              onClick={() => pickArt(a.slug)}
              aria-pressed={shownArt === a.slug}
              aria-label={`${a.title}, ${a.artist}`}
              className={`relative aspect-square overflow-hidden rounded-xs border-2 transition-[border-color,transform] active:scale-95 ${shownArt === a.slug ? "border-paper" : "border-transparent"}`}
            >
              <Image src={`/art/${a.slug}-nb.jpg`} alt="" width={a.width} height={a.height} sizes="140px" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
