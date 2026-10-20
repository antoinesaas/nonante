"use client";

import { trackEvent } from "@/lib/track";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { completeWakeQuiz, startChallengeSession, startSession } from "@/app/actions/proofs";
import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { formatDuration, mathText } from "@/lib/math";
import type { MathChecked, StartedSession } from "@/lib/types";
import { btnPrimary, btnSecondary } from "@/lib/ui";

type Props =
  | { mode: "principle"; principleId: string; label: string; window: { from: string; to: string } }
  | { mode: "challenge"; assignmentId: string; label: string; window: { from: string; to: string } };

type Result = { ok: boolean; questions?: MathChecked[]; correct?: number; total?: number; bonus?: number; points?: number; ms?: number; level?: number; next?: number };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"] as const;

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Réveil : ouvrir l'app avant l'heure et répondre à cinq calculs de tête, un par écran, avec un clavier numérique
 * et le chrono qui tourne (le temps qui compte est mesuré par le serveur). Une erreur ne coûte rien, chaque bonne
 * réponse est un bonus.
 */
export function WakeCheck(props: Props) {
  const { m, locale } = useI18n();
  const t = m.app.proofs;
  const tm = m.app.math;
  const [session, setSession] = useState<StartedSession | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const skew = useRef(0);
  const questions = session?.questions ?? [];
  const current = answers[index] ?? "";

  // Chrono : départ à l'heure du serveur (horloge du téléphone corrigée).
  useEffect(() => {
    if (!session || result) return;
    const started = new Date(session.started_at).getTime();
    const id = window.setInterval(() => setElapsed(Date.now() + skew.current - started), 250);
    return () => window.clearInterval(id);
  }, [session, result]);

  async function start() {
    setBusy(true);
    setMessage(null);
    const r = props.mode === "principle" ? await startSession(props.principleId) : await startChallengeSession(props.assignmentId, null);
    setBusy(false);
    if (r.session) {
      skew.current = new Date(r.session.server_now).getTime() - Date.now();
      setSession(r.session);
      setAnswers((r.session.questions ?? []).map(() => ""));
      setIndex(0);
    } else setMessage(r.message ?? t.startFailed);
  }

  const submit = useCallback(
    async (list: string[]) => {
      if (!session) return;
      setBusy(true);
      const r = await completeWakeQuiz(
        session.id,
        session.nonce,
        list.map((a) => Number(a)),
      );
      setBusy(false);
      if (r.status === "completed") {
        navigator.vibrate?.([12, 40, 12]);
        trackEvent("calcul_mental", { justes: r.correct ?? 0, niveau: r.level ?? 0 });
        setResult({ ok: true, questions: r.questions, correct: r.correct, total: r.total, bonus: r.bonus, points: r.points, ms: r.duration_ms, level: r.level, next: r.next_level });
      } else if (r.status === "error") {
        setMessage(r.message ?? t.startFailed);
      } else {
        setResult({ ok: false });
        setMessage(r.reason ?? r.message ?? t.tooLate);
      }
    },
    [session, t],
  );

  const press = useCallback(
    (key: (typeof KEYS)[number]) => {
      if (busy || !session) return;
      navigator.vibrate?.(6);
      if (key === "del") {
        setAnswers((prev) => prev.map((a, j) => (j === index ? a.slice(0, -1) : a)));
        return;
      }
      if (key === "ok") {
        if (!current) return;
        if (index < questions.length - 1) setIndex(index + 1);
        else void submit(answers);
        return;
      }
      setAnswers((prev) => prev.map((a, j) => (j === index && a.length < 6 ? (a === "0" ? key : a + key) : a)));
    },
    [busy, session, index, current, questions.length, submit, answers],
  );

  // Clavier physique (ordinateur) : chiffres, effacer, Entrée.
  useEffect(() => {
    if (!session || result) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key as (typeof KEYS)[number]);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") press("ok");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, result, press]);

  if (result) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="my-auto space-y-5 text-center">
          <p className="animate-pop font-display text-[44px] leading-none">{result.ok ? t.awake : t.notValid}</p>
          {result.ok ? (
            <>
              <p className="text-mute">{result.points ? fmt(m.app.timer.donePoints, { n: result.points }) : t.wakeProven}</p>
              <div className="glow-mint animate-in rounded-[1.75rem] p-5 text-left">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[13px] text-paper/75">{tm.correctLabel}</p>
                    <p className="font-dot text-[44px] leading-none">
                      {result.correct}
                      <span className="text-[24px] text-paper/60">/{result.total}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] text-paper/75">{tm.time}</p>
                    <p className="font-dot text-[28px] leading-none">{result.ms !== undefined ? clock(result.ms) : "—"}</p>
                  </div>
                </div>
                <p className={`mt-3 text-sm font-semibold ${result.bonus ? "text-paper" : "text-paper/70"}`}>{result.bonus ? fmt(tm.bonus, { n: result.bonus }) : tm.noBonus}</p>
                {result.next !== undefined && result.level !== undefined ? (
                  <p className="mt-1 text-[13px] text-paper/75">
                    {fmt(result.next > result.level ? tm.levelUp : result.next < result.level ? tm.levelDown : tm.levelSame, { n: result.next })}
                  </p>
                ) : null}
                <ul className="mt-3 space-y-1.5 rounded-2xl bg-black/35 p-3 text-sm">
                  {(result.questions ?? []).map((q, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-4 tabular-nums">
                      <span>
                        {mathText(q, locale, tm.percentOf)} = <span className={q.correct ? "text-[#5cf0a6]" : "text-ko line-through"}>{q.given}</span>
                      </span>
                      {q.correct ? <span className="text-[#5cf0a6]">✓</span> : <span className="text-paper/70">{fmt(tm.right, { n: q.answer })}</span>}
                    </li>
                  ))}
                </ul>
                {result.ms !== undefined ? <p className="mt-2 text-right text-xs text-paper/70">{fmt(tm.inTime, { time: formatDuration(result.ms, m.common.units) })}</p> : null}
              </div>
              <Link href="/app/notes#calcul" className={`${btnSecondary} w-full`}>
                {tm.track}
              </Link>
            </>
          ) : (
            <p className="text-mute">{message}</p>
          )}
        </div>
        <Link href="/app" replace className={`${btnPrimary} mt-6`}>
          {m.app.timer.finish}
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="my-auto text-center">
          <p className="text-sm text-mute">{props.label}</p>
          <h1 className="mt-4 font-display text-[40px] leading-[1.05]">{t.wakeHeading}</h1>
          <p className="mt-3 text-mute">{fmt(t.wakeWindow, props.window)}</p>
          <div className="glow-mint mx-auto mt-8 grid size-44 place-items-center rounded-full">
            <span className="font-dot text-[44px] leading-none">5×</span>
          </div>
          <p className="mx-auto mt-8 max-w-xs text-sm text-mute">{tm.hint}</p>
        </div>
        {message ? (
          <p role="alert" className="mb-4 text-center text-sm">
            {message}
          </p>
        ) : null}
        <button type="button" onClick={start} disabled={busy} className={btnPrimary}>
          {busy ? "…" : t.wakeButton}
        </button>
      </div>
    );
  }

  const q = questions[index];
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" aria-hidden="true">
          {questions.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-paper" : i < index ? "w-1.5 bg-[#5cf0a6]" : "w-1.5 bg-white/20"}`} />
          ))}
        </div>
        <span className="liquid rounded-full px-3 py-1.5 font-dot text-[17px] leading-none" aria-label={tm.elapsed}>
          {clock(elapsed)}
        </span>
      </div>

      <div key={index} className="my-auto animate-in py-6 text-center">
        <p className="text-[13px] text-mute">{fmt(tm.answer, { n: index + 1 })}</p>
        <p className="mt-3 font-display text-[52px] leading-none tabular-nums">{q ? mathText(q, locale, tm.percentOf) : ""}</p>
        <p className={`mt-6 font-dot text-[56px] leading-none ${current ? "text-paper" : "text-white/20"}`} aria-live="polite">
          {current || "?"}
        </p>
      </div>

      {message ? (
        <p role="alert" className="mb-3 text-center text-sm">
          {message}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2.5 pb-1">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            disabled={busy || (k === "ok" && !current)}
            aria-label={k === "del" ? m.common.actions.remove : k === "ok" ? (index < questions.length - 1 ? m.common.actions.continue : tm.submit) : k}
            className={`press grid h-14 place-items-center rounded-2xl text-[24px] font-medium disabled:opacity-40 ${k === "ok" ? "pearl" : "liquid"}`}
          >
            {k === "del" ? (
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 5 H19 C20.1 5 21 5.9 21 7 V17 C21 18.1 20.1 19 19 19 H9 L3 12 Z" />
                <path d="M12 9.5 L16.5 14 M16.5 9.5 L12 14" />
              </svg>
            ) : k === "ok" ? (
              busy ? (
                "…"
              ) : (
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {index < questions.length - 1 ? <path d="M5 12 H19 M13 6 L19 12 L13 18" /> : <path d="M5 12.5 L10 17.5 L19 7.5" />}
                </svg>
              )
            ) : (
              k
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
