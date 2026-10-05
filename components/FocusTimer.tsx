"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { abandonSession, completeSession, heartbeat, startChallengeSession, startSession } from "@/app/actions/proofs";
import { Ring } from "@/components/Ring";
import type { StartedSession } from "@/lib/types";
import { btnLink, btnPrimary, btnSecondary } from "@/lib/ui";

type Phase = "ready" | "starting" | "running" | "finishing" | "completed" | "broken" | "abandoned";

type Props =
  | { mode: "principle"; principleId: string; label: string; minutes: number }
  | { mode: "challenge"; assignmentId: string; label: string; minutes: null };

const HEARTBEAT_MS = 15_000;
const HIDDEN_LIMIT_MS = 10_000;

function mmss(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Minuteur de concentration (§5). Le serveur décide de tout : heure de début, battements, fin.
 * Ce composant ne fait que montrer le temps et prévenir le serveur quand la page est quittée.
 */
export function FocusTimer(props: Props) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [minutes, setMinutes] = useState<number>(props.minutes ?? 50);
  const [remaining, setRemaining] = useState<number>((props.minutes ?? 50) * 60);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [points, setPoints] = useState<number | null>(null);

  const session = useRef<StartedSession | null>(null);
  const skew = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const finishing = useRef(false);

  const total = minutes * 60;

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      wakeLock.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      wakeLock.current = null;
    }
  }, []);

  const stopped = useCallback((status: string, reason?: string) => {
    if (status === "broken") {
      setPhase("broken");
      setMessage(reason ?? "La session a cassé.");
    } else if (status === "abandoned") {
      setPhase("abandoned");
    }
    void wakeLock.current?.release().catch(() => {});
  }, []);

  const beat = useCallback(
    async (visible: boolean, hiddenMs: number) => {
      const s = session.current;
      if (!s) return;
      const r = await heartbeat(s.id, s.nonce, visible, hiddenMs);
      if (r.status === "broken" || r.status === "abandoned") stopped(r.status, r.reason);
    },
    [stopped],
  );

  const finish = useCallback(async () => {
    const s = session.current;
    if (!s || finishing.current) return;
    finishing.current = true;
    setPhase("finishing");
    const r = await completeSession(s.id, s.nonce);
    if (r.status === "completed") {
      setPhase("completed");
      setPoints(r.points ?? null);
      void wakeLock.current?.release().catch(() => {});
    } else if (r.status === "error") {
      // Le serveur n'a pas encore compté assez de temps : on réessaie dans quelques secondes.
      setTimeout(() => {
        finishing.current = false;
      }, 3000);
      setPhase("running");
      setMessage(r.message ?? null);
    } else {
      stopped(r.status, r.reason);
    }
  }, [stopped]);

  async function start() {
    setPhase("starting");
    setMessage(null);
    const r = props.mode === "principle" ? await startSession(props.principleId) : await startChallengeSession(props.assignmentId, minutes);
    if (!r.session) {
      setPhase("ready");
      setMessage(r.message ?? "Impossible de lancer la session.");
      return;
    }
    session.current = r.session;
    skew.current = Date.parse(r.session.server_now) - Date.now();
    setMinutes(r.session.minutes ?? minutes);
    setRemaining((r.session.minutes ?? minutes) * 60);
    setPhase("running");
    await requestWakeLock();
    void beat(true, 0);
  }

  useEffect(() => {
    if (phase !== "running") return;
    const s = session.current!;
    const end = Date.parse(s.started_at) + (s.minutes ?? 0) * 60_000;

    const tick = setInterval(() => {
      const left = (end - (Date.now() + skew.current)) / 1000;
      setRemaining(left);
      if (left <= -2) void finish();
    }, 500);

    const pulse = setInterval(() => {
      const hiddenMs = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      void beat(hiddenMs <= HIDDEN_LIMIT_MS, hiddenMs);
    }, HEARTBEAT_MS);

    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        // Si le navigateur laisse tourner le script en arrière-plan, on casse au bout de 10 s.
        hiddenTimer = setTimeout(() => {
          if (hiddenAt.current) void beat(false, Date.now() - hiddenAt.current);
        }, HIDDEN_LIMIT_MS + 500);
      } else {
        if (hiddenTimer) clearTimeout(hiddenTimer);
        const hiddenMs = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
        hiddenAt.current = null;
        void beat(hiddenMs <= HIDDEN_LIMIT_MS, hiddenMs);
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(tick);
      clearInterval(pulse);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase, beat, finish, requestWakeLock]);

  async function abandon() {
    const s = session.current;
    if (!s) return;
    const r = await abandonSession(s.id, s.nonce);
    stopped(r.status === "error" ? "abandoned" : r.status);
  }

  const progress = phase === "ready" || phase === "starting" ? 0 : 1 - Math.max(0, remaining) / total;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center px-5 pt-8 pb-12 text-center">
      <p className="text-sm text-mute">{props.label}</p>

      <div className="relative my-auto flex items-center justify-center py-10">
        <Ring progress={phase === "completed" ? 1 : progress} broken={phase === "broken"} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-serif text-7xl leading-none tabular-nums">
            {phase === "completed" ? "00:00" : mmss(phase === "ready" || phase === "starting" ? minutes * 60 : remaining)}
          </p>
          {phase === "running" ? <p className="mt-3 text-xs text-mute">en cours</p> : null}
        </div>
      </div>

      <div className="w-full space-y-4">
        {phase === "ready" || phase === "starting" ? (
          <>
            {props.mode === "challenge" ? (
              <div className="flex justify-center gap-3">
                {[25, 50, 90].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMinutes(m);
                      setRemaining(m * 60);
                    }}
                    aria-pressed={minutes === m}
                    className={`h-10 w-16 rounded-xs border text-sm ${minutes === m ? "border-paper bg-paper text-ink" : "border-line"}`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            ) : null}
            <p className="text-sm leading-relaxed text-mute">
              Téléphone posé, écran vers le haut. Si tu quittes cet écran plus de 10 secondes, la session casse.
            </p>
            <button type="button" onClick={start} disabled={phase === "starting"} className={btnPrimary}>
              {phase === "starting" ? "Lancement…" : "Lancer"}
            </button>
            <Link href="/app" className={btnLink}>
              Retour
            </Link>
          </>
        ) : null}

        {phase === "running" || phase === "finishing" ? (
          <>
            <p className="leading-relaxed">Reste sur cet écran. Si tu le quittes, la session casse.</p>
            {confirmAbandon ? (
              <div className="flex justify-center gap-3">
                <button type="button" onClick={abandon} className={btnSecondary}>
                  Confirmer : −5 points
                </button>
                <button type="button" onClick={() => setConfirmAbandon(false)} className={btnSecondary}>
                  Continuer
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmAbandon(true)} className={btnLink}>
                Abandonner (−5 points)
              </button>
            )}
          </>
        ) : null}

        {phase === "completed" ? (
          <>
            <p className="font-serif text-4xl">Session tenue.</p>
            {points !== null ? <p className="text-mute">+{points} points, preuve forte.</p> : null}
            <Link href="/app" className={btnPrimary}>
              Retour
            </Link>
          </>
        ) : null}

        {phase === "broken" || phase === "abandoned" ? (
          <>
            <p className="font-serif text-4xl">{phase === "broken" ? "La session a cassé." : "Session abandonnée."}</p>
            <p className="text-mute">{phase === "broken" ? message : null} −5 points.</p>
            <Link href="/app" className={btnPrimary}>
              Retour
            </Link>
          </>
        ) : null}

        {message && (phase === "ready" || phase === "running") ? (
          <p role="alert" className="text-sm">
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}
