"use client";

import { useActionState } from "react";
import { updateSettings } from "@/app/actions/profile";
import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { idle } from "@/lib/errors";
import { MATH_MODES, type MathMode } from "@/lib/math";
import { btnPrimary, input, label } from "@/lib/ui";

export function SettingsForm({ isPublic, walletPublic, bio, mathMode }: { isPublic: boolean; walletPublic: boolean; bio: string | null; mathMode: MathMode }) {
  const { m } = useI18n();
  const t = m.app.profile;
  const [state, action] = useActionState(updateSettings, idle);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <span>{t.language}</span>
        <LanguageSwitcher />
      </div>
      <form action={action} className="space-y-6">
        <label className="block">
          <span className={label}>{t.bio}</span>
          <input name="bio" defaultValue={bio ?? ""} maxLength={140} placeholder={t.bioPlaceholder} className={`${input} mt-2`} />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>
            {t.public}
            <span className="block text-xs text-mute">{t.publicHint}</span>
          </span>
          <input type="checkbox" name="isPublic" defaultChecked={isPublic} className="size-5 shrink-0 accent-white" />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>
            {t.walletPublic}
            <span className="block text-xs text-mute">{t.walletPublicHint}</span>
          </span>
          <input type="checkbox" name="walletPublic" defaultChecked={walletPublic} className="size-5 shrink-0 accent-white" />
        </label>
        <label className="block">
          <span className={label}>{t.mathMode}</span>
          <select name="mathMode" defaultValue={mathMode} className={`${input} mt-2`}>
            {MATH_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t.mathModes[mode]}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-mute">{t.mathModeHint}</span>
        </label>
        <SubmitButton className={btnPrimary} pendingLabel={m.common.actions.saving}>
          {m.common.actions.save}
        </SubmitButton>
        <FormMessage message={state.message} ok={state.ok} />
      </form>
    </div>
  );
}
