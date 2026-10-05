"use client";

import Link from "next/link";
import { useState } from "react";
import { completeWake, startChallengeSession, startSession } from "@/app/actions/proofs";
import type { StartedSession } from "@/lib/types";
import { btnLink, btnPrimary, input } from "@/lib/ui";

type Props =
  | { mode: "principle"; principleId: string; label: string; window: string }
  | { mode: "challenge"; assignmentId: string; label: string; window: string };

/** Réveil : ouvrir l'app avant l'heure et recopier le code affiché (§5). */
export function WakeCheck(props: Props) {
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
    else setMessage(r.message ?? "Impossible de démarrer.");
  }

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    const r = await completeWake(session.id, session.nonce, code);
    setBusy(false);
    if (r.status === "completed") {
      setResult("ok");
      setMessage(r.points ? `+${r.points} points, preuve forte.` : "Réveil prouvé.");
    } else if (r.status === "running") {
      setMessage(r.error ?? "Code incorrect.");
      setCode("");
    } else {
      setResult("ko");
      setMessage(r.reason ?? r.message ?? "Trop tard.");
    }
  }

  if (result) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-serif text-4xl">{result === "ok" ? "Debout." : "Pas validé."}</p>
        <p className="text-mute">{message}</p>
        <Link href="/app" className={btnPrimary}>
          Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <p className="text-sm text-mute">{props.label}</p>
      {!session ? (
        <>
          <h1 className="font-serif text-5xl leading-none">Prouve que tu es debout.</h1>
          <p className="text-mute">Entre {props.window}.</p>
          <button type="button" onClick={start} disabled={busy} className={btnPrimary}>
            {busy ? "…" : "Je suis debout"}
          </button>
        </>
      ) : (
        <form onSubmit={check} className="space-y-6">
          <p className="text-mute">Recopie ce code.</p>
          <p className="font-serif text-7xl tracking-[0.15em] tabular-nums select-none" aria-label={`Code ${session.code?.split("").join(" ")}`}>
            {session.code}
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="______"
            aria-label="Code recopié"
            className={`${input} text-center font-serif text-3xl tracking-[0.3em]`}
          />
          <button type="submit" disabled={busy || code.length !== 6} className={btnPrimary}>
            {busy ? "Vérification…" : "Valider"}
          </button>
        </form>
      )}
      {message ? (
        <p role="alert" className="text-sm">
          {message}
        </p>
      ) : null}
      <Link href="/app" className={btnLink}>
        Retour
      </Link>
    </div>
  );
}
