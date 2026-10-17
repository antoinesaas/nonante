"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { addGrade, deleteGrade } from "@/app/actions/grades";
import { FileField } from "@/components/FileField";
import { useI18n } from "@/components/I18nProvider";
import { Sheet } from "@/components/Sheet";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { compressField } from "@/lib/compress-image";
import { idle } from "@/lib/errors";
import { btnLink, btnPrimary, input, label } from "@/lib/ui";

/** Bouton blanc « Ajouter une note » : le formulaire s'ouvre dans une feuille. */
export function AddGrade({ today, minDay, subjects, rule, todayLine }: { today: string; minDay: string; subjects: string[]; rule: string; todayLine: string | null }) {
  const { m } = useI18n();
  const t = m.app.grades;
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
        <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
          <path d="M8 3 V13 M3 8 H13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {t.add}
      </button>
      {done ? (
        <p role="status" className="mt-3 animate-in rounded-2xl bg-ok/12 px-4 py-3 text-sm text-ok">
          {done}
        </p>
      ) : null}
      <Sheet open={open} onClose={() => setOpen(false)} title={t.add}>
        <p className="text-sm text-mute">{rule}</p>
        {todayLine ? <p className="mt-1 text-sm">{todayLine}</p> : null}
        <div className="mt-5">
          {open ? (
            <GradeForm
              today={today}
              minDay={minDay}
              subjects={subjects}
              onDone={(message) => {
                setOpen(false);
                setDone(message);
              }}
            />
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

export function GradeForm({ today, minDay, subjects, onDone }: { today: string; minDay: string; subjects: string[]; onDone?: (message: string | null) => void }) {
  const { m } = useI18n();
  const t = m.app.grades;
  const [state, formAction] = useActionState(addGrade, idle);
  useEffect(() => {
    if (state.ok) onDone?.(state.message);
  }, [state, onDone]);

  return (
    <form
      action={async (fd) => {
        const data = await compressField(fd, "proof");
        startTransition(() => formAction(data));
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className={label}>{t.subject}</span>
        <input name="subject" list="subjects" placeholder={t.subjectPlaceholder} minLength={2} maxLength={60} required className={`${input} mt-2`} />
        <datalist id="subjects">
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-3">
        <label className="block">
          <span className={label}>{t.score}</span>
          <input name="score" inputMode="decimal" placeholder="14,5" required className={`${input} mt-2 font-display text-xl`} />
        </label>
        <label className="block">
          <span className={label}>{t.outOf}</span>
          <input name="outOf" inputMode="decimal" defaultValue="20" required className={`${input} mt-2`} />
        </label>
        <label className="block">
          <span className={label}>{t.coefficient}</span>
          <input name="coefficient" inputMode="decimal" defaultValue="1" required className={`${input} mt-2`} />
        </label>
      </div>
      <label className="block">
        <span className={label}>{t.date}</span>
        <input name="day" type="date" defaultValue={today} min={minDay} max={today} required className={`${input} mt-2`} />
      </label>
      <FileField name="proof" label={t.proof} placeholder={t.proofPlaceholder} choose={t.choose} hint={t.proofHint} />
      <SubmitButton className={btnPrimary} pendingLabel={m.common.actions.sending}>
        {t.submit}
      </SubmitButton>
      <FormMessage message={state.message} ok={state.ok} />
    </form>
  );
}

export function DeleteGradeButton({ id }: { id: string }) {
  const { m } = useI18n();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string | null } | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await deleteGrade(id)))}
        className={`${btnLink} text-xs ${pending ? "opacity-50" : ""}`}
      >
        {m.app.grades.remove}
      </button>
      {result && !result.ok ? <span className="ml-2 text-xs">{result.message}</span> : null}
    </>
  );
}
