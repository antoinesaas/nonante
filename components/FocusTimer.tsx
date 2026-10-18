"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { abandonSession, completeSession, heartbeat, leaveSession, startChallengeSession, startSession } from "@/app/actions/proofs";
import { Aura } from "@/components/Aura";
import { useI18n } from "@/components/I18nProvider";
import { Ring } from "@/components/Ring";
import { AMBIENCES, Ambience, type AmbienceKind, PAD_DEFAULT, type Pad } from "@/lib/ambience";
import { SoundPad } from "@/components/SoundPad";
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

/** Écart entre l'horloge du serveur et celle du téléphone. */
function clockSkew(serverNow: string): number {
  return Date.parse(serverNow) - Date.now();
}

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
      <path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const cls = "liquid press grid size-10 place-items-center rounded-full";
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

const AMBIENCE_ICON: Record<AmbienceKind, React.ReactNode> = {
  none: <path d="M5 9 V15 H8.5 L13 19 V5 L8.5 9 Z M17 9.5 L21 14.5 M21 9.5 L17 14.5" />,
  focus: <path d="M9 18 A2.5 2.5 0 1 1 9 17.9 Z M9 18 V5 L19 3 V16 M19 16 A2.5 2.5 0 1 1 19 15.9 Z M9 9 L19 7" />,
  rain: <path d="M7 14 A4.5 4.5 0 0 1 8 5.2 A5.5 5.5 0 0 1 18.5 7.5 A3.5 3.5 0 0 1 18 14 M8 17 L7 20 M12 17 L11 20 M16 17 L15 20" />,
  forest: <path d="M12 3 L6 12 H9.5 L5.5 18 H18.5 L14.5 12 H18 Z M12 18 V21" />,
  road: <path d="M8 3 L5 21 M16 3 L19 21 M12 4 V7 M12 10 V13 M12 16 V19" />,
  ocean: <path d="M3 9 C5.5 7 7.5 11 10 9 S14.5 7 17 9 S19.5 11 21 9 M3 14 C5.5 12 7.5 16 10 14 S14.5 12 17 14 S19.5 16 21 14" />,
  fire: <path d="M12 3 C12 7 7.5 8.5 7.5 13.5 A4.5 4.5 0 0 0 16.5 13.5 C16.5 10.5 14.5 9.5 14.5 7.5 C13.5 9 12.5 9.5 11.8 9.8 C12.3 7.5 12.5 5 12 3 Z" />,
  brown: <path d="M3 12 H5 L6.5 8 L8.5 16 L10.5 6 L12.5 18 L14.5 9 L16.5 14 L18 11 H21" />,
};

const AMBIENCE_KEY = "nonante:ambiance";
const PAD_KEY = "nonante:pave";
const noSubscribe = () => () => {};

/** Ambiance choisie la dernière fois (préférence de ce téléphone seulement). */
function savedAmbience(): AmbienceKind {
  try {
    const saved = window.localStorage.getItem(AMBIENCE_KEY) as AmbienceKind | null;
    return saved && AMBIENCES.includes(saved) ? saved : "none";
  } catch {
    // Stockage indisponible (navigation privée) : « silence ».
    return "none";
  }
}

/** Réglage du pavé gardé sur ce téléphone, sous forme de texte « x,y » (valeur stable pour React). */
function savedPadText(): string {
  try {
    return window.localStorage.getItem(PAD_KEY) ?? "";
  } catch {
    return "";
  }
}

function parsePad(text: string): Pad {
  const [x, y] = text.split(",").map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) } : PAD_DEFAULT;
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
  const saved = useSyncExternalStore(noSubscribe, savedAmbience, () => "none" as AmbienceKind);
  const [chosen, setSound] = useState<AmbienceKind | null>(null);
  const sound = chosen ?? saved;
  const [volume, setVolume] = useState(0.7);
  const [soundSheet, setSoundSheet] = useState(false);
  const savedPad = useSyncExternalStore(noSubscribe, savedPadText, () => "");
  const [movedPad, setPad] = useState<Pad | null>(null);
  const pad = movedPad ?? parsePad(savedPad);
  const ambience = useRef<Ambience | null>(null);

  const session = useRef<StartedSession | null>(null);
  const principleId = useRef(props.mode === "principle" ? props.principleId : "");
  const phaseRef = useRef<Phase>("ready");
  const skew = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const finishing = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Page quittée : le son s'arrête.
  useEffect(() => () => ambience.current?.dispose(), []);

  function playSound(kind: AmbienceKind) {
    ambience.current ??= new Ambience();
    const a = ambience.current;
    a.setVolume(volume);
    a.setPad(pad);
    a.setTitle(`${t.sounds[kind]} · ${props.label}`);
    a.play(kind);
  }

  function changePad(p: Pad) {
    setPad(p);
    ambience.current?.setPad(p);
  }

  function savePad(p: Pad) {
    try {
      window.localStorage.setItem(PAD_KEY, `${p.x.toFixed(3)},${p.y.toFixed(3)}`);
    } catch {
      // Préférence non gardée : sans conséquence.
    }
  }

  /** Choisir une ambiance la fait entendre tout de suite (geste de l'utilisateur : le son est autorisé sur iPhone). */
  function chooseSound(kind: AmbienceKind) {
    setSound(kind);
    try {
      window.localStorage.setItem(AMBIENCE_KEY, kind);
    } catch {
      // Préférence non gardée : sans conséquence.
    }
    playSound(kind);
  }

  // Fin de la session : le son s'efface.
  useEffect(() => {
    if (phase === "completed" || phase === "broken" || phase === "abandoned") ambience.current?.stop();
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
    if (sound !== "none") playSound(sound);
    const r =
      props.mode === "principle"
        ? await startSession(principleId.current, minutes === props.minutes ? undefined : minutes)
        : await startChallengeSession(props.assignmentId, minutes);
    const newId: string | undefined = "principleId" in r && typeof r.principleId === "string" ? r.principleId : undefined;
    if (newId && newId !== principleId.current) {
      // Durée changée : le principe a une nouvelle version, l'adresse suit (un rechargement casse la bonne session).
      principleId.current = newId;
      window.history.replaceState(window.history.state, "", `/app/session/${newId}`);
    }
    if (!r.session) {
      setPhase("ready");
      setMessage(r.message ?? t.startFailed);
      ambience.current?.stop();
      return;
    }
    session.current = r.session;
    skew.current = clockSkew(r.session.server_now);
    setMinutes(r.session.minutes ?? minutes);
    setRemaining((r.session.minutes ?? minutes) * 60);
    // Le geste « retour » ouvre la confirmation au lieu de quitter la page.
    window.history.pushState({ ...window.history.state, nonanteSession: true }, "", window.location.href);
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
      window.history.pushState({ ...window.history.state, nonanteSession: true }, "", window.location.href);
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

  const soundChips = (
    <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {AMBIENCES.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => chooseSound(k)}
          aria-pressed={sound === k}
          className={`press flex h-10 shrink-0 snap-start items-center gap-2 rounded-full px-3.5 text-sm font-medium ${sound === k ? "pearl" : "liquid text-paper/85"}`}
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {AMBIENCE_ICON[k]}
          </svg>
          {t.sounds[k]}
        </button>
      ))}
    </div>
  );

  return (
    <main className="relative isolate mx-auto flex min-h-dvh w-full max-w-xl flex-col overflow-x-clip px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.75rem,env(safe-area-inset-bottom))]">
      <Aura tone="rose" className={running ? "opacity-70" : ""} />
      <div className="relative z-10 flex h-11 items-center justify-between">
        {running ? <BackArrow label={t.back} onClick={() => setConfirmStop(true)} /> : <BackArrow label={t.back} href="/app" />}
        {running ? (
          <button type="button" onClick={() => setSoundSheet(true)} className="liquid press flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium">
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {AMBIENCE_ICON[sound]}
            </svg>
            {t.sounds[sound]}
          </button>
        ) : null}
      </div>
      <p className="relative z-10 mt-3 text-center text-sm text-mute">
        {props.mode === "principle" ? props.label.replace(/\b\d+(?=\s?(minutes|minute|min|Minuten|minutos)\b)/, String(minutes)) : props.label}
      </p>

      <div className="relative z-10 my-auto flex items-center justify-center py-6">
        <div className={`transition-transform duration-700 ease-out ${running ? "scale-100" : "scale-[0.96]"}`}>
          <Ring progress={phase === "completed" ? 1 : progress} broken={phase === "broken"} />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-dot text-[64px] leading-none">{phase === "completed" ? "00:00" : mmss(phase === "ready" || phase === "starting" ? minutes * 60 : remaining)}</p>
          {running ? <p className="mt-3 animate-breathe text-[13px] font-medium text-[#ff7aa8]">{t.running}</p> : null}
        </div>
      </div>

      <div className="relative z-10 w-full space-y-4 text-center">
        {phase === "ready" || phase === "starting" ? (
          <>
            <div className="space-y-2">
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
                    className={`press h-10 rounded-full px-4 text-sm font-medium ${minutes === n ? "pearl" : "liquid text-paper/85"}`}
                  >
                    {fmt(t.minutes, { n })}
                  </button>
                ))}
              </div>
              {props.mode === "principle" ? <p className="text-xs text-mute">{t.durationHint}</p> : null}
            </div>
            <div className="text-left">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-medium text-mute">{t.soundTitle}</p>
                <button type="button" onClick={() => setSoundSheet(true)} className="liquid press flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 7 H20 M4 17 H20" />
                    <circle cx="9" cy="7" r="2.2" fill="currentColor" />
                    <circle cx="15" cy="17" r="2.2" fill="currentColor" />
                  </svg>
                  {t.pad.open}
                </button>
              </div>
              {soundChips}
            </div>
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
          <div className="animate-in">
            <p className="font-display text-[34px]">{phase === "completed" ? t.done : phase === "broken" ? t.broken : t.abandoned}</p>
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

      <Sheet open={soundSheet && !ended} onClose={() => setSoundSheet(false)} title={t.pad.title}>
        {soundChips}
        <p className="mt-4 mb-4 text-sm text-mute">{t.pad.hint}</p>
        <SoundPad value={pad} onChange={changePad} onCommit={savePad} />
        <label className="mt-5 block">
          <span className="text-[13px] font-medium text-mute">{t.volume}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              ambience.current?.setVolume(v);
            }}
            className="mt-3 w-full accent-[#9b6bff]"
          />
        </label>
        <button type="button" onClick={() => setSoundSheet(false)} className={`${btnPrimary} mt-6 mb-2`}>
          {t.pad.done}
        </button>
      </Sheet>

      <Sheet open={confirmStop && running} onClose={() => setConfirmStop(false)} title={t.stopTitle}>
        <p className="text-sm text-mute">{t.stopText}</p>
        <div className="mt-6 space-y-3 pb-2">
          <button type="button" onClick={stop} className="press inline-flex h-14 w-full items-center justify-center rounded-full bg-ko px-6 font-semibold text-white">
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
