"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { type ProofResult, submitPhoto } from "@/app/actions/proofs";
import { btnLink, btnPrimary, btnSecondary } from "@/lib/ui";

type Props = {
  kind: "principle" | "audit" | "challenge";
  targetId: string;
  title: string;
  detail: string;
};

const initial: ProofResult = { ok: false, message: null };
const MAX_SIDE = 1600;

/**
 * Photo prise dans l'app avec la caméra (pas d'accès à la galerie).
 * Réduite à 1600 px sur le téléphone ; le serveur vérifie, ré-encode et retire les métadonnées.
 */
export function PhotoCapture({ kind, targetId, title, detail }: Props) {
  const [phase, setPhase] = useState<"intro" | "camera" | "preview" | "denied">("intro");
  const [preview, setPreview] = useState<string | null>(null);
  const [state, action, pending] = useActionState(submitPhoto, initial);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const blob = useRef<Blob | null>(null);

  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  useEffect(() => () => stop(), []);

  async function openCamera() {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      setPhase("camera");
      requestAnimationFrame(async () => {
        if (video.current) {
          video.current.srcObject = stream.current;
          await video.current.play().catch(() => {});
        }
      });
    } catch {
      setPhase("denied");
    }
  }

  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (b) => {
        if (!b) return;
        blob.current = b;
        setPreview(URL.createObjectURL(b));
        setPhase("preview");
        stop();
      },
      "image/jpeg",
      0.85,
    );
  }

  function send(formData: FormData) {
    if (!blob.current) return;
    formData.set("photo", new File([blob.current], "preuve.jpg", { type: "image/jpeg" }));
    action(formData);
  }

  if (state.ok) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-serif text-4xl">Envoyé.</p>
        <p className="text-mute">{state.message}</p>
        <Link href="/app" className={btnPrimary}>
          Retour
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-4xl leading-tight">{title}</h1>
      <p className="text-sm leading-relaxed text-mute">{detail}</p>

      {phase === "camera" ? (
        <div className="aspect-[3/4] w-full overflow-hidden bg-surface">
          <video ref={video} playsInline muted className="h-full w-full object-cover" />
        </div>
      ) : null}
      {phase === "preview" && preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), jamais envoyé ailleurs qu'au serveur
        <img src={preview} alt="Aperçu de la photo" className="w-full" />
      ) : null}

      {phase === "intro" ? (
        <button type="button" onClick={openCamera} className={btnPrimary}>
          Ouvrir la caméra
        </button>
      ) : null}
      {phase === "camera" ? (
        <button type="button" onClick={capture} className={btnPrimary}>
          Prendre la photo
        </button>
      ) : null}
      {phase === "preview" ? (
        <form action={send} className="space-y-3">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="targetId" value={targetId} />
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Envoi…" : "Envoyer cette photo"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              blob.current = null;
              void openCamera();
            }}
            className={btnSecondary}
          >
            Reprendre
          </button>
        </form>
      ) : null}
      {phase === "denied" ? <p role="alert">Caméra refusée. Autorise-la dans les réglages du navigateur pour prouver.</p> : null}
      {state.message ? (
        <p role="alert" className="text-sm">
          {state.message}
        </p>
      ) : null}
      <Link href="/app" className={btnLink}>
        Retour
      </Link>
    </div>
  );
}
