"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import { removeAvatar, updateSettings, uploadAvatar } from "@/app/actions/profile";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { compressField } from "@/lib/compress-image";
import { idle } from "@/lib/errors";
import { btnLink, btnSecondary, btnSmall, input, label } from "@/lib/ui";

type ArtOption = { slug: string; title: string; artist: string; width: number; height: number };

export function AvatarForm({ hasAvatar }: { hasAvatar: boolean }) {
  const [state, formAction] = useActionState(uploadAvatar, idle);
  const [pending, startTransition] = useTransition();
  const [removed, setRemoved] = useState<string | null>(null);
  return (
    <div>
      <form
        action={async (fd) => {
          const data = await compressField(fd, "avatar");
          startTransition(() => formAction(data));
        }}
        className="flex flex-wrap items-center gap-3"
      >
        <label className={`${btnSmall} cursor-pointer`}>
          {hasAvatar ? "Changer ma photo" : "Ajouter une photo"}
          <input
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          />
        </label>
        {hasAvatar ? (
          <button type="button" disabled={pending} onClick={() => startTransition(async () => setRemoved((await removeAvatar()).message))} className={btnLink}>
            Retirer
          </button>
        ) : null}
        <SubmitButton className="sr-only" pendingLabel="Envoi…">
          Envoyer
        </SubmitButton>
      </form>
      <FormMessage message={state.message ?? removed} ok={state.ok || Boolean(removed)} />
    </div>
  );
}

export function SettingsForm({
  isPublic,
  emailReminders,
  walletPublic,
  bio,
  art,
  arts,
}: {
  isPublic: boolean;
  emailReminders: boolean;
  walletPublic: boolean;
  bio: string | null;
  art: string;
  arts: ArtOption[];
}) {
  const [state, action] = useActionState(updateSettings, idle);
  const [selected, setSelected] = useState(art);

  return (
    <form action={action} className="mt-6 space-y-6">
      <label className="block">
        <span className={label}>Bio</span>
        <input name="bio" defaultValue={bio ?? ""} maxLength={140} placeholder="Agence web, 21 ans, debout à 6 h." className={`${input} mt-2`} />
      </label>
      <label className="flex items-center justify-between gap-4">
        <span>
          Profil public
          <span className="block text-xs text-mute">Ta carte au classement et ta page /u/ visibles.</span>
        </span>
        <input type="checkbox" name="isPublic" defaultChecked={isPublic} className="size-5 accent-paper" />
      </label>
      <label className="flex items-center justify-between gap-4">
        <span>
          Revenus sur mon profil public
          <span className="block text-xs text-mute">Le total prouvé de ton portefeuille, rien d&apos;autre.</span>
        </span>
        <input type="checkbox" name="walletPublic" defaultChecked={walletPublic} className="size-5 accent-paper" />
      </label>
      <label className="flex items-center justify-between gap-4">
        <span>
          Rappels par email
          <span className="block text-xs text-mute">Si les notifications ne sont pas activées.</span>
        </span>
        <input type="checkbox" name="emailReminders" defaultChecked={emailReminders} className="size-5 accent-paper" />
      </label>

      <fieldset>
        <legend className="text-sm">Fond de ta carte</legend>
        <p className="mt-1 text-xs text-mute">D&apos;autres fonds se débloquent avec les niveaux et les succès.</p>
        <input type="hidden" name="art" value={selected} />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {arts.map((a) => (
            <button
              key={a.slug}
              type="button"
              onClick={() => setSelected(a.slug)}
              aria-pressed={selected === a.slug}
              aria-label={`${a.title}, ${a.artist}`}
              className={`aspect-square overflow-hidden border-2 ${selected === a.slug ? "border-paper" : "border-ink/0"}`}
            >
              <Image src={`/art/${a.slug}-nb.jpg`} alt="" width={a.width} height={a.height} sizes="180px" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </fieldset>

      <SubmitButton className={btnSecondary} pendingLabel="Enregistrement…">
        Enregistrer
      </SubmitButton>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}
