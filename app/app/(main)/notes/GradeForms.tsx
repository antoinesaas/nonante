"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { addGrade, deleteGrade } from "@/app/actions/grades";
import { FileField } from "@/components/FileField";
import { useI18n } from "@/components/I18nProvider";
import { FormMessage, SubmitButton } from "@/components/SubmitButton";
import { compressField } from "@/lib/compress-image";
import { idle } from "@/lib/errors";
import { btnLink, btnPrimary, input, label } from "@/lib/ui";

export function GradeForm({ today, minDay, subjects }: { today: string; minDay: string; subjects: string[] }) {
  const { m } = useI18n();
  const t = m.app.grades;
  const [state, formAction] = useActionState(addGrade, idle);

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
          <input name="score" inputMode="decimal" placeholder="14,5" required className={`${input} mt-2 font-serif text-xl`} />
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
