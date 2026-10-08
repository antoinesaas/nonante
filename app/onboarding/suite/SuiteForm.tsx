"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { finishArc, type FinishState } from "@/app/actions/onboarding";
import { useI18n } from "@/components/I18nProvider";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { btnLink, btnPrimary, input, label } from "@/lib/ui";

const initial: FinishState = { message: null };

export function SuiteForm({
  needsProfile,
  pseudo: initialPseudo,
  isPublic,
  needsPayment,
  cta,
  currentYear,
}: {
  needsProfile: boolean;
  pseudo: string;
  isPublic: boolean;
  needsPayment: boolean;
  cta: string;
  currentYear: number;
}) {
  const { m } = useI18n();
  const t = m.quiz.suite;
  const [state, formAction] = useActionState(finishArc, initial);
  // Champs contrôlés : React ne les vide pas si le serveur renvoie une erreur.
  const [pseudo, setPseudo] = useState(initialPseudo);
  const [birthYear, setBirthYear] = useState("");
  const [adult, setAdult] = useState(false);
  const [visible, setVisible] = useState(isPublic);
  const [waiver, setWaiver] = useState(false);

  return (
    <form action={formAction} className="space-y-6">
      {needsProfile ? (
        <>
          <label className="block">
            <span className={label}>{t.pseudo}</span>
            <input
              name="pseudo"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
              required
              minLength={3}
              autoCapitalize="none"
              className={`${input} mt-2 font-serif text-2xl`}
            />
          </label>
          <label className="block">
            <span className={label}>{t.birthYear}</span>
            <input
              name="birthYear"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              required
              inputMode="numeric"
              pattern="(19|20)[0-9]{2}"
              maxLength={4}
              placeholder={String(currentYear - 21)}
              className={`${input} mt-2`}
            />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="adult" checked={adult} onChange={(e) => setAdult(e.target.checked)} required className="mt-0.5 size-5 shrink-0 accent-paper" />
            {t.adult}
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="isPublic" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-paper" />
            {t.public}
          </label>
        </>
      ) : null}

      {needsPayment ? (
        <label className="flex items-start gap-3 text-xs text-mute">
          <input type="checkbox" name="waiver" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} required className="mt-0.5 size-4 shrink-0 accent-paper" />
          <span>{m.game.plans.waiver}</span>
        </label>
      ) : null}

      <SubmitButton className={btnPrimary} pendingLabel={needsPayment ? t.toPayment : t.launching}>
        {cta}
      </SubmitButton>
      <FormMessage message={state.message} />
      <p className="text-xs text-mute">
        {needsPayment ? t.secure : ""}
        {t.accept}{" "}
        <Link href="/legal/cgu" className="underline underline-offset-2">
          {t.terms}
        </Link>
        {needsPayment ? (
          <>
            {" "}
            {t.and}{" "}
            <Link href="/legal/cgv" className="underline underline-offset-2">
              {t.sales}
            </Link>
          </>
        ) : null}
        .
      </p>
      <Link href="/onboarding" className={btnLink}>
        {t.edit}
      </Link>
    </form>
  );
}
