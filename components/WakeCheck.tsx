"use client";

import Link from "next/link";
import { useState } from "react";
import { completeWake, startChallengeSession, startSession } from "@/app/actions/proofs";
import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import type { StartedSession } from "@/lib/types";
import { btnPrimary, input } from "@/lib/ui";

type Props =
  | { mode: "principle"; principleId: string; label: string; window: { from: string; to: string } }
  | { mode: "challenge"; assignmentId: string; label: string; window: { from: string; to: string } };

/** Réveil : ouvrir l'app avant l'heure et recopier le code affiché (§5). */
export function WakeCheck(props: Props) {
  const { m } = useI18n();
  const t = m.app.proofs;
  const [session, setSession] = useState<StartedSession | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<"ok" | "ko" | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setMessage(null);
    const r = props.mode === "principle" ? await startSession(props.principleId) : await startChallengeSession(props.assignmentId, null);
    setBusy(false);
    if (r.session) setSession(r.session);
    else setMessage(r.message ?? t.startFailed);
  }

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    const r = await completeWake(session.id, session.nonce, code);
    setBusy(false);
    if (r.status === "completed") {
      setResult("ok");
      setMessage(r.points ? fmt(m.app.timer.donePoints, { n: r.points }) : t.wakeProven);
    } else if (r.status === "running") {
      setMessage(r.error ?? t.badCode);
      setCode("");
    } else {
      setResult("ko");
      setMessage(r.reason ?? r.message ?? t.tooLate);
    }
  }

  if (result) {
    return (
      <div className="space-y-4 text-center">
        <p className="animate-pop font-serif text-5xl">{result === "ok" ? t.awake : t.notValid}</p>
        <p className="text-mute">{message}</p>
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
          <button type="button" onClick={start} disabled={busy} className={btnPrimary}>
            {busy ? "…" : t.wakeButton}
          </button>
        </>
      ) : (
        <form onSubmit={check} className="animate-step space-y-6">
          <p className="text-mute">{t.copyCode}</p>
          <p className="font-serif text-7xl tracking-[0.15em] tabular-nums select-none" aria-label={fmt(t.codeAria, { code: session.code?.split("").join(" ") })}>
            {session.code}
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="______"
            aria-label={t.codeTyped}
            className={`${input} text-center font-serif text-3xl tracking-[0.3em]`}
          />
          <button type="submit" disabled={busy || code.length !== 6} className={btnPrimary}>
            {busy ? t.checking : t.validate}
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
