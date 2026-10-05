"use client";

import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { completeReps, startChallengeSession, startSession, validateDeclaratif } from "@/app/actions/proofs";
import { type Exercise, jointAngle, RepTracker } from "@/lib/reps";
import type { StartedSession } from "@/lib/types";
import { btnLink, btnPrimary, btnSecondary } from "@/lib/ui";

type Props =
  | { mode: "principle"; principleId: string; label: string; exercise: Exercise; target: number; weakPoints: number }
  | { mode: "challenge"; assignmentId: string; label: string; exercise: Exercise; target: null; weakPoints: null };

type Phase = "intro" | "loading" | "ready" | "counting" | "submitting" | "done" | "rejected" | "denied" | "error";

const NAMES: Record<Exercise, string> = { pushup: "pompes", squat: "squats" };

/**
 * Comptage des répétitions à la caméra, entièrement sur le téléphone (§5).
 * Aucune image ne quitte l'appareil : seuls le nombre et l'horodatage de chaque répétition partent au serveur.
 */
export function RepCounter(props: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<string>("Mets-toi en place.");
  const [message, setMessage] = useState<string | null>(null);

  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const landmarker = useRef<PoseLandmarker | null>(null);
  const tracker = useRef<RepTracker | null>(null);
  const session = useRef<StartedSession | null>(null);
  const t0 = useRef(0);
  const frame = useRef<number | null>(null);
  const submitted = useRef(false);

  function stopCamera() {
    if (frame.current) cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  useEffect(() => () => {
    stopCamera();
    landmarker.current?.close();
  }, []);

  async function enableCamera() {
    setPhase("loading");
    setMessage(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch {
      setPhase("denied");
      return;
    }
    try {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      // Fichiers servis par Nonante (public/mediapipe et public/models) : aucun appel à un service tiers.
      const vision = await FilesetResolver.forVisionTasks("/mediapipe");
      const options = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate },
        runningMode: "VIDEO" as const,
        numPoses: 1,
      });
      // GPU si possible, sinon processeur (plus lent mais disponible partout).
      landmarker.current = await PoseLandmarker.createFromOptions(vision, options("GPU")).catch(() =>
        PoseLandmarker.createFromOptions(vision, options("CPU")),
      );
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      setPhase("ready");
      preview();
    } catch {
      stopCamera();
      setPhase("error");
      setMessage("La détection n'a pas pu démarrer sur ce téléphone.");
    }
  }

  // Avant de commencer : on vérifie seulement que le corps est bien cadré.
  function preview() {
    const loop = () => {
      const v = video.current;
      const lm = landmarker.current;
      if (v && lm && v.readyState >= 2 && !tracker.current) {
        const result = lm.detectForVideo(v, performance.now());
        const a = jointAngle(result.landmarks[0], props.exercise);
        setStatus(a === null ? "Recule : épaules et hanches doivent être visibles." : "Cadrage bon. Tu peux commencer.");
      }
      if (!tracker.current) frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
  }

  async function begin() {
    const r = props.mode === "principle" ? await startSession(props.principleId) : await startChallengeSession(props.assignmentId, null);
    if (!r.session) {
      setMessage(r.message ?? "Impossible de démarrer.");
      return;
    }
    session.current = r.session;
    tracker.current = new RepTracker(props.exercise);
    t0.current = performance.now();
    setCount(0);
    setPhase("counting");
    if (frame.current) cancelAnimationFrame(frame.current);

    let lastVideoTime = -1;
    const loop = () => {
      const v = video.current;
      const lm = landmarker.current;
      const tr = tracker.current;
      if (v && lm && tr && v.readyState >= 2 && v.currentTime !== lastVideoTime) {
        lastVideoTime = v.currentTime;
        const now = performance.now();
        const result = lm.detectForVideo(v, now);
        const a = jointAngle(result.landmarks[0], props.exercise);
        if (a === null) {
          setStatus("Recule : épaules et hanches doivent être visibles.");
        } else {
          const event = tr.update(a, now - t0.current);
          if (event === "rep") {
            setCount(tr.reps.length);
            if (props.target !== null && tr.reps.length >= props.target) {
              void submit();
              return;
            }
          }
          setStatus(
            event === "too_fast"
              ? "Trop rapide : celle-ci ne compte pas."
              : event === "too_slow"
                ? "Trop lent : plus de 6 secondes, celle-ci ne compte pas."
                : tr.phase === "down" || tr.phase === "descending"
                  ? "Remonte."
                  : "Descends.",
          );
        }
      }
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
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
      setMessage(r.points ? `+${r.points} points, preuve forte.` : `${r.count ?? tr.reps.length} ${NAMES[props.exercise]} comptées.`);
    } else {
      setPhase("rejected");
      setMessage(r.reason ?? r.message ?? "Répétitions refusées.");
    }
  }

  async function withoutCamera() {
    if (props.mode !== "principle") return;
    const r = await validateDeclaratif(props.principleId);
    setPhase(r.ok ? "done" : "error");
    setMessage(r.message);
  }

  const goal = props.target !== null ? `${props.target} ${NAMES[props.exercise]}` : NAMES[props.exercise];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-8 pb-10">
      <p className="text-center text-sm text-mute">{props.label}</p>

      <div className={`relative mt-6 aspect-[3/4] w-full overflow-hidden bg-surface ${phase === "ready" || phase === "counting" ? "" : "hidden"}`}>
        <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        {phase === "counting" ? (
          <div className="absolute inset-x-0 bottom-0 bg-ink/70 p-4 text-center">
            <p className="font-serif text-7xl leading-none tabular-nums">
              {count}
              {props.target !== null ? <span className="text-3xl text-mute"> / {props.target}</span> : null}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-auto flex flex-col items-center gap-4 pt-8 text-center">
        {phase === "intro" ? (
          <>
            <h1 className="font-serif text-4xl leading-tight">{goal}, comptées.</h1>
            <p className="text-sm leading-relaxed text-mute">
              Pose ton téléphone au sol, de profil, à environ deux mètres. Épaules et hanches doivent rester dans le cadre.
              L&apos;analyse se fait sur ton téléphone : aucune image n&apos;en sort.
            </p>
            <button type="button" onClick={enableCamera} className={btnPrimary}>
              Activer la caméra
            </button>
            {props.mode === "principle" ? (
              <button type="button" onClick={withoutCamera} className={btnLink}>
                Valider sans caméra ({props.weakPoints} points au lieu de {props.weakPoints * 2})
              </button>
            ) : null}
          </>
        ) : null}

        {phase === "loading" ? <p className="text-mute">Préparation de la caméra…</p> : null}

        {phase === "ready" ? (
          <>
            <p className="text-sm">{status}</p>
            <button type="button" onClick={begin} className={btnPrimary}>
              Commencer
            </button>
          </>
        ) : null}

        {phase === "counting" ? (
          <>
            <p>{status}</p>
            {props.target === null ? (
              <button type="button" onClick={submit} className={btnPrimary}>
                Terminer
              </button>
            ) : (
              <p className="text-xs text-mute">Chaque répétition doit durer entre 0,8 et 6 secondes.</p>
            )}
          </>
        ) : null}

        {phase === "submitting" ? <p className="text-mute">Vérification…</p> : null}

        {phase === "denied" ? (
          <>
            <p>Caméra refusée.</p>
            {props.mode === "principle" ? (
              <button type="button" onClick={withoutCamera} className={btnSecondary}>
                Valider sans caméra ({props.weakPoints} points)
              </button>
            ) : null}
          </>
        ) : null}

        {phase === "done" || phase === "rejected" || phase === "error" ? (
          <>
            <p className="font-serif text-3xl">{phase === "done" ? "Compté." : "Pas validé."}</p>
            {message ? <p className="text-mute">{message}</p> : null}
            <Link href="/app" className={btnPrimary}>
              Retour
            </Link>
          </>
        ) : null}

        {message && (phase === "ready" || phase === "counting") ? (
          <p role="alert" className="text-sm">
            {message}
          </p>
        ) : null}

        {phase !== "done" && phase !== "rejected" && phase !== "error" ? (
          <Link href="/app" className={btnLink}>
            Retour
          </Link>
        ) : null}
      </div>
    </main>
  );
}
