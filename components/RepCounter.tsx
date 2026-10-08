"use client";

import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { completeReps, startChallengeSession, startSession, validateDeclaratif } from "@/app/actions/proofs";
import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { type Exercise, jointAngle, RepTracker } from "@/lib/reps";
import type { StartedSession } from "@/lib/types";
import { btnLink, btnPrimary, btnSecondary } from "@/lib/ui";

type Props =
  | { mode: "principle"; principleId: string; label: string; exercise: Exercise; target: number; weakPoints: number }
  | { mode: "challenge"; assignmentId: string; label: string; exercise: Exercise; target: null; weakPoints: null };

type Phase = "intro" | "loading" | "ready" | "counting" | "submitting" | "done" | "rejected" | "denied" | "error";

// Le modèle (wasm + réseau de pose) est chargé une seule fois par visite, et gardé entre deux pages.
let model: Promise<PoseLandmarker> | null = null;

function loadModel(delegate: "GPU" | "CPU" = "GPU"): Promise<PoseLandmarker> {
  if (model && delegate === "GPU") return model;
  model = (async () => {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    // Fichiers servis par Nonante (public/mediapipe et public/models) : aucun appel à un service tiers.
    const vision = await FilesetResolver.forVisionTasks("/mediapipe");
    const options = (d: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate: d },
      runningMode: "VIDEO" as const,
      numPoses: 1,
    });
    // GPU si possible, sinon processeur (plus lent mais disponible partout).
    if (delegate === "CPU") return PoseLandmarker.createFromOptions(vision, options("CPU"));
    return PoseLandmarker.createFromOptions(vision, options("GPU")).catch(() => PoseLandmarker.createFromOptions(vision, options("CPU")));
  })();
  model.catch(() => {
    model = null;
  });
  return model;
}

type VideoWithFrames = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number; cancelVideoFrameCallback?: (id: number) => void };

/**
 * Comptage des répétitions à la caméra, entièrement sur le téléphone.
 * Aucune image ne quitte l'appareil : seuls le nombre et l'horodatage de chaque répétition partent au serveur.
 */
export function RepCounter(props: Props) {
  const { m } = useI18n();
  const t = m.app.reps;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<string>(t.frame);
  const [message, setMessage] = useState<string | null>(null);

  const video = useRef<VideoWithFrames>(null);
  const stream = useRef<MediaStream | null>(null);
  const landmarker = useRef<PoseLandmarker | null>(null);
  const tracker = useRef<RepTracker | null>(null);
  const session = useRef<StartedSession | null>(null);
  const t0 = useRef(0);
  const loop = useRef<{ raf: number | null; vfc: number | null }>({ raf: null, vfc: null });
  const submitted = useRef(false);
  const shown = useRef(t.frame);
  const gpuFailed = useRef(false);

  const name = t.names[props.exercise];

  /** Texte d'aide : un rendu seulement quand il change (pas 30 fois par seconde). */
  function say(text: string) {
    if (shown.current === text) return;
    shown.current = text;
    setStatus(text);
  }

  function stopLoop() {
    const v = video.current;
    if (loop.current.raf) cancelAnimationFrame(loop.current.raf);
    if (loop.current.vfc && v?.cancelVideoFrameCallback) v.cancelVideoFrameCallback(loop.current.vfc);
    loop.current.raf = null;
    loop.current.vfc = null;
  }

  function stopCamera() {
    stopLoop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  // Préchargement du modèle dès l'ouverture de la page : la caméra démarre ensuite bien plus vite.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void };
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => void loadModel().catch(() => {})) : window.setTimeout(() => void loadModel().catch(() => {}), 300);
    const frames = loop.current;
    const v = video.current;
    const media = stream;
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else clearTimeout(id);
      // Page quittée : caméra coupée (la lumière verte s'éteint).
      if (frames.raf) cancelAnimationFrame(frames.raf);
      if (frames.vfc && v?.cancelVideoFrameCallback) v.cancelVideoFrameCallback(frames.vfc);
      media.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  /** Appelle `step` à chaque nouvelle image de la caméra (requestVideoFrameCallback si possible). */
  function everyFrame(step: () => boolean) {
    stopLoop();
    const v = video.current;
    const next = () => {
      if (!step()) return;
      if (v?.requestVideoFrameCallback) loop.current.vfc = v.requestVideoFrameCallback(next);
      else loop.current.raf = requestAnimationFrame(next);
    };
    next();
  }

  /** Détection sur l'image courante ; si le GPU plante en cours de route, on repasse sur le processeur. */
  function detect(v: HTMLVideoElement, now: number): number | null | undefined {
    const lm = landmarker.current;
    if (!lm) return undefined;
    try {
      return jointAngle(lm.detectForVideo(v, now).landmarks[0], props.exercise);
    } catch {
      if (!gpuFailed.current) {
        gpuFailed.current = true;
        landmarker.current = null;
        void loadModel("CPU").then((cpu) => {
          landmarker.current = cpu;
        });
      }
      return undefined;
    }
  }

  async function enableCamera() {
    setPhase("loading");
    setMessage(null);
    const modelReady = loadModel();
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
        audio: false,
      });
    } catch (e) {
      setPhase(e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "denied" : "error");
      if (!(e instanceof DOMException && e.name === "NotAllowedError")) setMessage(t.failed);
      return;
    }
    const v = video.current;
    try {
      if (!v) throw new Error("vidéo");
      // La vidéo reste affichée pendant le chargement : Safari ne lance pas une vidéo cachée.
      v.srcObject = stream.current;
      v.muted = true;
      await v.play().catch(() => {});
      if (v.readyState < 2) await new Promise<void>((resolve) => v.addEventListener("loadeddata", () => resolve(), { once: true }));
      landmarker.current = await modelReady;
    } catch {
      stopCamera();
      setPhase("error");
      setMessage(t.failed);
      return;
    }
    setPhase("ready");
    // Avant de commencer : on vérifie seulement que le corps est bien cadré.
    everyFrame(() => {
      if (tracker.current) return false;
      const a = detect(v, performance.now());
      if (a !== undefined) say(a === null ? t.frame : t.framed);
      return true;
    });
  }

  async function begin() {
    const r = props.mode === "principle" ? await startSession(props.principleId) : await startChallengeSession(props.assignmentId, null);
    if (!r.session) {
      setMessage(r.message ?? t.startFailed);
      return;
    }
    session.current = r.session;
    const tr = new RepTracker(props.exercise);
    tracker.current = tr;
    t0.current = performance.now();
    setCount(0);
    setPhase("counting");
    say(t.down);
    const v = video.current!;
    everyFrame(() => {
      const now = performance.now();
      const a = detect(v, now);
      if (a === undefined) return true;
      if (a === null) {
        say(t.frame);
        return true;
      }
      const event = tr.update(a, now - t0.current);
      if (event === "rep") {
        setCount(tr.reps.length);
        if (navigator.vibrate) navigator.vibrate(30);
        if (props.target !== null && tr.reps.length >= props.target) {
          void submit();
          return false;
        }
      }
      say(event === "too_fast" ? t.tooFast : event === "too_slow" ? t.tooSlow : tr.phase === "down" || tr.phase === "descending" ? t.up : t.down);
      return true;
    });
  }

  async function submit() {
    const s = session.current;
    const tr = tracker.current;
    if (!s || !tr || submitted.current) return;
    submitted.current = true;
    stopCamera();
    setPhase("submitting");
    const r = await completeReps(s.id, s.nonce, tr.reps);
    if (r.status === "completed") {
      setPhase("done");
      setMessage(r.points ? fmt(t.points, { n: r.points }) : fmt(t.counted, { n: r.count ?? tr.reps.length, name }));
    } else {
      setPhase("rejected");
      setMessage(r.reason ?? r.message ?? t.refused);
    }
  }

  async function withoutCamera() {
    if (props.mode !== "principle") return;
    stopCamera();
    const r = await validateDeclaratif(props.principleId);
    setPhase(r.ok ? "done" : "error");
    setMessage(r.message);
  }

  const goal = props.target !== null ? `${props.target} ${name}` : name;
  const cameraVisible = phase === "loading" || phase === "ready" || phase === "counting";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="flex h-11 items-center">
        <Link href="/app" aria-label={m.common.actions.back} className="-ml-2 grid size-11 place-items-center rounded-full text-mute transition-[color,transform] hover:text-paper active:scale-90">
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
      <p className="mt-2 text-center text-sm text-mute">{props.label}</p>

      <div className={`relative mt-6 aspect-[3/4] w-full overflow-hidden rounded-xs bg-surface ${cameraVisible ? "animate-fade" : "hidden"}`}>
        <video ref={video} playsInline muted autoPlay className="h-full w-full -scale-x-100 object-cover" />
        {phase === "loading" ? (
          <div className="absolute inset-0 grid place-items-center bg-ink/60">
            <p className="shimmer-text text-sm">{t.loading}</p>
          </div>
        ) : null}
        {phase === "ready" ? (
          <p className={`absolute inset-x-3 top-3 rounded-full px-4 py-2 text-center text-sm transition-colors ${status === t.framed ? "bg-paper text-ink" : "glass text-paper"}`}>{status}</p>
        ) : null}
        {phase === "counting" ? (
          <>
            <p className="glass absolute inset-x-3 top-3 rounded-full px-4 py-2 text-center text-sm">{status}</p>
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink/90 to-transparent p-5 pt-12 text-center">
              <p className="font-serif text-8xl leading-none tabular-nums">
                <span key={count} className="inline-block animate-pop">
                  {count}
                </span>
                {props.target !== null ? <span className="text-3xl text-mute"> / {props.target}</span> : null}
              </p>
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-auto flex flex-col items-center gap-4 pt-8 text-center">
        {phase === "intro" ? (
          <>
            <h1 className="font-serif text-4xl leading-tight">{fmt(t.goal, { goal })}</h1>
            <p className="text-sm leading-relaxed text-mute">{t.setup}</p>
            <button type="button" onClick={enableCamera} className={btnPrimary}>
              {t.enable}
            </button>
            {props.mode === "principle" ? (
              <button type="button" onClick={withoutCamera} className={btnLink}>
                {fmt(t.without, { n: props.weakPoints, full: props.weakPoints * 2 })}
              </button>
            ) : null}
          </>
        ) : null}

        {phase === "ready" ? (
          <button type="button" onClick={begin} className={btnPrimary}>
            {t.begin}
          </button>
        ) : null}

        {phase === "counting" ? (
          props.target === null ? (
            <button type="button" onClick={submit} className={btnPrimary}>
              {t.finish}
            </button>
          ) : (
            <p className="text-xs text-mute">{t.rule}</p>
          )
        ) : null}

        {phase === "submitting" ? <p className="shimmer-text">{t.checking}</p> : null}

        {phase === "denied" ? (
          <>
            <p>{t.denied}</p>
            <button type="button" onClick={enableCamera} className={btnSecondary}>
              {t.retry}
            </button>
            {props.mode === "principle" ? (
              <button type="button" onClick={withoutCamera} className={btnLink}>
                {fmt(t.withoutShort, { n: props.weakPoints })}
              </button>
            ) : null}
          </>
        ) : null}

        {phase === "error" ? (
          <>
            <p className="font-serif text-3xl">{t.notValid}</p>
            {message ? <p className="text-mute">{message}</p> : null}
            <button type="button" onClick={enableCamera} className={btnPrimary}>
              {t.retry}
            </button>
            {props.mode === "principle" ? (
              <button type="button" onClick={withoutCamera} className={btnLink}>
                {fmt(t.withoutShort, { n: props.weakPoints })}
              </button>
            ) : null}
          </>
        ) : null}

        {phase === "done" || phase === "rejected" ? (
          <div className="w-full animate-rise">
            <p className="font-serif text-4xl">{phase === "done" ? t.done : t.notValid}</p>
            {message ? <p className="mt-2 text-mute">{message}</p> : null}
            <button type="button" onClick={() => router.replace("/app")} className={`${btnPrimary} mt-6`}>
              {m.app.timer.finish}
            </button>
          </div>
        ) : null}

        {message && (phase === "ready" || phase === "counting") ? (
          <p role="alert" className="text-sm">
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}
