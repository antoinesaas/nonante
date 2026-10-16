"use client";

import Link from "next/link";
import { useState } from "react";
import { completeWakeQuiz, startChallengeSession, startSession } from "@/app/actions/proofs";
import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { mathText } from "@/lib/math";
import type { MathChecked, StartedSession } from "@/lib/types";
import { btnPrimary, btnSecondary } from "@/lib/ui";

type Props =
  | { mode: "principle"; principleId: string; label: string; window: { from: string; to: string } }
  | { mode: "challenge"; assignmentId: string; label: string; window: { from: string; to: string } };

/** Réveil : ouvrir l'app avant l'heure et répondre à trois calculs (§5). Une erreur ne coûte rien, chaque bonne réponse est un bonus. */
export function WakeCheck(props: Props) {
  const { m, locale } = useI18n();
  const t = m.app.proofs;
  const tm = m.app.math;
  const [session, setSession] = useState<StartedSession | null>(null);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; questions?: MathChecked[]; correct?: number; total?: number; bonus?: number; points?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const questions = session?.questions ?? [];

  async function start() {
    setBusy(true);
    setMessage(null);
    const r = props.mode === "principle" ? await startSession(props.principleId) : await startChallengeSession(props.assignmentId, null);
    setBusy(false);
    if (r.session) {
      setSession(r.session);
      setAnswers((r.session.questions ?? []).map(() => ""));
    } else setMessage(r.message ?? t.startFailed);
  }

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    const r = await completeWakeQuiz(session.id, session.nonce, answers.map((a) => Number(a)));
    setBusy(false);
    if (r.status === "completed") {
      setResult({ ok: true, questions: r.questions, correct: r.correct, total: r.total, bonus: r.bonus, points: r.points });
    } else if (r.status === "error") {
      setMessage(r.message ?? t.startFailed);
    } else {
      setResult({ ok: false });
      setMessage(r.reason ?? r.message ?? t.tooLate);
    }
  }

  if (result) {
    return (
      <div className="space-y-6 text-center">
        <p className="animate-pop font-serif text-5xl">{result.ok ? t.awake : t.notValid}</p>
        {result.ok ? (
          <>
            <p className="text-mute">{result.points ? fmt(m.app.timer.donePoints, { n: result.points }) : t.wakeProven}</p>
            <div className="border border-line bg-surface p-4 text-left">
              <p className="flex items-baseline justify-between gap-4">
                <span className="font-serif text-2xl">{fmt(tm.score, { correct: result.correct ?? 0, total: result.total ?? 3 })}</span>
                <span className={`text-sm ${result.bonus ? "text-ok" : "text-mute"}`}>{result.bonus ? fmt(tm.bonus, { n: result.bonus }) : tm.noBonus}</span>
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {(result.questions ?? []).map((q, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-4">
                    <span className="tabular-nums">
                      {mathText(q, locale, tm.percentOf)} = <span className={q.correct ? "text-ok" : "text-ko line-through"}>{q.given}</span>
                    </span>
                    {q.correct ? <span className="text-ok">✓</span> : <span className="text-mute">{fmt(tm.right, { n: q.answer })}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/app/notes#calcul" className={`${btnSecondary} w-full`}>
              {tm.track}
            </Link>
          </>
        ) : (
          <p className="text-mute">{message}</p>
        )}
        <Link href="/app" replace className={btnPrimary}>
          {m.app.timer.finish}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <p className="text-sm text-mute">{props.label}</p>
      {!session ? (
        <>
          <h1 className="font-serif text-5xl leading-none">{t.wakeHeading}</h1>
          <p className="text-mute">{fmt(t.wakeWindow, props.window)}</p>
          <p className="text-sm text-mute">{tm.hint}</p>
          <button type="button" onClick={start} disabled={busy} className={btnPrimary}>
            {busy ? "…" : t.wakeButton}
          </button>
        </>
      ) : (
        <form onSubmit={check} className="animate-step space-y-6">
          <p className="text-mute">{tm.intro}</p>
          <ol className="space-y-4">
            {questions.map((q, i) => (
              <li key={i} className="flex items-center gap-4">
                <span className="flex-1 text-right font-serif text-3xl tabular-nums">{mathText(q, locale, tm.percentOf)} =</span>
                <input
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value.replace(/\D/g, "").slice(0, 7) : a)))}
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus={i === 0}
                  aria-label={fmt(tm.answer, { n: i + 1 })}
                  className="h-14 w-28 flex-none rounded-xs border border-line bg-surface px-2 text-center font-serif text-2xl text-paper tabular-nums focus:border-paper focus:outline-none"
                />
              </li>
            ))}
          </ol>
          <button type="submit" disabled={busy || answers.some((a) => a === "")} className={btnPrimary}>
            {busy ? t.checking : tm.submit}
          </button>
        </form>
      )}
      {message ? (
        <p role="alert" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
