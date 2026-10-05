"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { updateSettings } from "@/app/actions/profile";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { btnSecondary } from "@/lib/ui";

type ArtOption = { slug: string; title: string; artist: string; width: number; height: number };

export function SettingsForm({
  isPublic,
  emailReminders,
  art,
  arts,
}: {
  isPublic: boolean;
  emailReminders: boolean;
  art: string;
  arts: ArtOption[];
}) {
  const [state, action] = useActionState(updateSettings, idle);
  const [selected, setSelected] = useState(art);

  return (
    <form action={action} className="mt-6 space-y-6">
      <label className="flex items-center justify-between gap-4">
        <span>
          Profil public
          <span className="block text-xs text-mute">Pseudo au classement et page /u/ visible.</span>
        </span>
        <input type="checkbox" name="isPublic" defaultChecked={isPublic} className="size-5 accent-paper" />
      </label>
      <label className="flex items-center justify-between gap-4">
        <span>
          Rappels par email
          <span className="block text-xs text-mute">Si les notifications ne sont pas activées.</span>
        </span>
        <input type="checkbox" name="emailReminders" defaultChecked={emailReminders} className="size-5 accent-paper" />
      </label>

      <fieldset>
        <legend className="text-sm">Fond de profil</legend>
        <p className="mt-1 text-xs text-mute">Les œuvres se débloquent avec les niveaux et les succès.</p>
        <input type="hidden" name="art" value={selected} />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {arts.map((a) => (
            <button
              key={a.slug}
              type="button"
              onClick={() => setSelected(a.slug)}
              aria-pressed={selected === a.slug}
              aria-label={`${a.title}, ${a.artist}`}
              className={`aspect-square overflow-hidden border ${selected === a.slug ? "border-paper" : "border-line"}`}
            >
              <Image
                src={`/art/${a.slug}-nb.jpg`}
                alt=""
                width={a.width}
                height={a.height}
                sizes="180px"
                className="h-full w-full object-cover"
              />
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
