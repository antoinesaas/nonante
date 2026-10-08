"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { abandonSession, completeSession, heartbeat, leaveSession, startChallengeSession, startSession } from "@/app/actions/proofs";
import { useI18n } from "@/components/I18nProvider";
import { Ring } from "@/components/Ring";
import { Sheet } from "@/components/Sheet";
import type { Messages } from "@/lib/i18n/messages";
import { fmt } from "@/lib/i18n/format";
import type { StartedSession } from "@/lib/types";
import { btnPrimary, btnSecondary } from "@/lib/ui";

type Phase = "ready" | "starting" | "running" | "finishing" | "completed" | "broken" | "abandoned";

type Props = (
  | { mode: "principle"; principleId: string; label: string; minutes: number }
  | { mode: "challenge"; assignmentId: string; label: string; minutes: null }
) & {
  /** Une session de cette page tournait encore (page rechargée, appli rouverte) : elle casse dès l'ouverture. */
  orphan?: boolean;
};

const HEARTBEAT_MS = 15_000;
const HIDDEN_LIMIT_MS = 10_000;

function mmss(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Raison de la casse (déjà traduite par l'action serveur). */
function reasonText(reason: string | undefined, t: Messages["app"]["timer"]): string {
  if (!reason) return t.reasonLeft;
  // Message technique de Postgres en français : version plus parlante.
  if (reason.includes("battements se sont arrêtés")) return t.reasonBeats;
  if (reason.includes("Trop peu de battements")) return t.reasonShort;
  return reason;
}

function BackArrow({ label, onClick, href }: { label: string; onClick?: () => void; href?: string }) {
  const icon = (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
      <path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const cls = "-ml-2 grid size-11 place-items-center rounded-full text-mute transition-[color,transform] hover:text-paper active:scale-90";
  return href ? (
    <Link href={href} aria-label={label} className={cls}>
      {icon}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>
      {icon}
    </button>
  );
}

/**
 * Minuteur de concentration. Le serveur décide de tout : heure de début, battements, fin.
 * Deux boutons seulement : Lancer, puis Stop (confirmation : − 5 points). Quitter la page casse la session :
 * retour (bouton ou geste), autre onglet de l'app, onglet fermé (sendBeacon), plus de 10 s hors de l'écran.
 */
export function FocusTimer(props: Props) {
  const { m } = useI18n();
  const t = m.app.timer;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  const [minutes, setMinutes] = useState<number>(props.minutes ?? 50);
  const [remaining, setRemaining] = useState<number>((props.minutes ?? 50) * 60);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [points, setPoints] = useState<number | null>(null);

  const session = useRef<StartedSession | null>(null);
  const phaseRef = useRef<Phase>("ready");
  const skew = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const finishing = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const total = minutes * 60;

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      wakeLock.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      wakeLock.current = null;
    }
  }, []);

  const stopped = useCallback(
    (status: string, reason?: string) => {
      setConfirmStop(false);
      if (status === "broken") {
        setPhase("broken");
        setMessage(reasonText(reason, t));
      } else if (status === "abandoned") {
        setPhase("abandoned");
      }
      void wakeLock.current?.release().catch(() => {});
    },
    [t],
  );

  // Page rouverte alors qu'une session tournait : on ne reprend pas, elle casse.
  useEffect(() => {
    if (!props.orphan) return;
    void leaveSession().then((r) => {
      if (r.status === "broken") stopped("broken", r.reason);
    });
  }, [props.orphan, stopped]);

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
      setConfirmStop(false);
      void wakeLock.current?.release().catch(() => {});
    } else if (r.status === "error") {
      // Le serveur n'a pas encore compté assez de temps : on réessaie dans quelques secondes.
      setTimeout(() => {
        finishing.current = false;
      }, 3000);
      setPhase("running");
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
      setMessage(r.message ?? t.startFailed);
      return;
    }
    session.current = r.session;
    skew.current = Date.parse(r.session.server_now) - Date.now();
    setMinutes(r.session.minutes ?? minutes);
    setRemaining((r.session.minutes ?? minutes) * 60);
    // Le geste « retour » ouvre la confirmation au lieu de quitter la page.
    window.history.pushState({ ...window.history.state, nonanteSession: true }, "");
    setPhase("running");
    await requestWakeLock();
    void beat(true, 0);
  }

  // Pendant la session : chrono, battements, écran quitté, retour, onglet fermé.
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
        // Revenu après plus de 10 s : le serveur casse la session.
        void beat(hiddenMs <= HIDDEN_LIMIT_MS, hiddenMs);
        void requestWakeLock();
      }
    };
    const onPopState = () => {
      // Retour pendant la session : on reste sur la page et on demande confirmation.
      window.history.pushState({ ...window.history.state, nonanteSession: true }, "");
      setConfirmStop(true);
    };
    const onPageHide = () => {
      navigator.sendBeacon?.("/api/session/leave");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(tick);
      clearInterval(pulse);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [phase, beat, finish, requestWakeLock]);

  // Page quittée dans l'app (onglet de la barre, lien) pendant la session : elle casse.
  useEffect(
    () => () => {
      if (phaseRef.current === "running" || phaseRef.current === "finishing") void leaveSession();
    },
    [],
  );

  async function stop() {
    const s = session.current;
    if (!s) return;
    setConfirmStop(false);
    const r = await abandonSession(s.id, s.nonce);
    stopped(r.status === "error" ? "abandoned" : r.status, r.reason);
  }

  const running = phase === "running" || phase === "finishing";
  const ended = phase === "completed" || phase === "broken" || phase === "abandoned";
  const progress = phase === "ready" || phase === "starting" ? 0 : 1 - Math.max(0, remaining) / total;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="flex h-11 items-center">
        {running ? <BackArrow label={t.back} onClick={() => setConfirmStop(true)} /> : <BackArrow label={t.back} href="/app" />}
      </div>
      <p className="mt-2 text-center text-sm text-mute">{props.label}</p>

      <div className="relative my-auto flex items-center justify-center py-8">
        <div className={`transition-transform duration-700 ease-out ${running ? "scale-100" : "scale-[0.97]"}`}>
          <Ring progress={phase === "completed" ? 1 : progress} broken={phase === "broken"} />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-serif text-7xl leading-none tabular-nums">{phase === "completed" ? "00:00" : mmss(phase === "ready" || phase === "starting" ? minutes * 60 : remaining)}</p>
          {running ? <p className="mt-3 animate-breathe text-xs tracking-[0.2em] text-mute uppercase">{t.running}</p> : null}
        </div>
      </div>

      <div className="w-full space-y-4 text-center">
        {phase === "ready" || phase === "starting" ? (
          <>
            {props.mode === "challenge" ? (
              <div className="flex justify-center gap-2">
                {[25, 50, 90].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setMinutes(n);
                      setRemaining(n * 60);
                    }}
                    aria-pressed={minutes === n}
                    className={`h-10 rounded-full border px-4 text-sm transition-colors ${minutes === n ? "border-paper bg-paper text-ink" : "border-line"}`}
                  >
                    {fmt(t.minutes, { n })}
                  </button>
                ))}
              </div>
            ) : null}
            <button type="button" onClick={start} disabled={phase === "starting"} className={btnPrimary}>
              {phase === "starting" ? t.starting : t.start}
            </button>
            <p className="text-xs text-mute">{t.rule}</p>
          </>
        ) : null}

        {running ? (
          <button type="button" onClick={() => setConfirmStop(true)} disabled={phase === "finishing"} className={`${btnSecondary} w-full`}>
            {t.stop}
          </button>
        ) : null}

        {ended ? (
          <div className="animate-rise">
            <p className="font-serif text-4xl">{phase === "completed" ? t.done : phase === "broken" ? t.broken : t.abandoned}</p>
            <p className="mt-2 text-mute">
              {phase === "completed" ? (points !== null ? fmt(t.donePoints, { n: points }) : null) : `${phase === "broken" && message ? `${message} ` : ""}${t.penalty}`}
            </p>
            <button type="button" onClick={() => router.replace("/app")} className={`${btnPrimary} mt-6`}>
              {t.finish}
            </button>
          </div>
        ) : null}

        {message && phase === "ready" ? (
          <p role="alert" className="text-sm">
            {message}
          </p>
        ) : null}
      </div>

      <Sheet open={confirmStop && running} onClose={() => setConfirmStop(false)} title={t.stopTitle}>
        <p className="mt-2 text-sm text-mute">{t.stopText}</p>
        <div className="mt-6 space-y-3">
          <button type="button" onClick={stop} className="inline-flex h-14 w-full items-center justify-center rounded-xs bg-ko px-6 font-medium text-paper transition-transform active:scale-[0.98]">
            {t.stopConfirm}
          </button>
          <button type="button" onClick={() => setConfirmStop(false)} className={`${btnSecondary} w-full`}>
            {t.keepGoing}
          </button>
        </div>
      </Sheet>
    </main>
  );
}
