"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { type ProofResult, submitPhoto } from "@/app/actions/proofs";
import { useI18n } from "@/components/I18nProvider";
import { compressImage } from "@/lib/compress-image";
import { btnPrimary, btnSecondary } from "@/lib/ui";

type Props = {
  kind: "principle" | "audit" | "challenge" | "arc_avant" | "arc_apres";
  targetId: string;
  title: string;
  detail: string;
  /** « file » : capture d'écran choisie dans la galerie (preuves de type capture). */
  mode?: "camera" | "file";
  facing?: "environment" | "user";
  backHref?: string;
};

const initial: ProofResult = { ok: false, message: null };
const MAX_SIDE = 1600;

/**
 * Photo prise dans l'app avec la caméra (pas d'accès à la galerie), ou capture d'écran pour les preuves « capture ».
 * Réduite à 1600 px sur le téléphone ; le serveur vérifie, ré-encode et retire les métadonnées.
 */
export function PhotoCapture({ kind, targetId, title, detail, mode = "camera", facing = "environment", backHref = "/app" }: Props) {
  const { m } = useI18n();
  const t = m.app.proofs;
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
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 } },
        audio: false,
      });
      // La vidéo n'existe qu'une fois la phase « camera » affichée : le flux s'y branche dans attachVideo.
      setPhase("camera");
    } catch {
      setPhase("denied");
    }
  }

  /** Branche le flux dès que la vidéo apparaît dans la page. */
  function attachVideo(el: HTMLVideoElement | null) {
    video.current = el;
    if (el && stream.current && el.srcObject !== stream.current) {
      el.srcObject = stream.current;
      el.play().catch(() => {});
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

  async function pickFile(file: File | undefined) {
    if (!file) return;
    const small = await compressImage(file);
    blob.current = small;
    setPreview(URL.createObjectURL(small));
    setPhase("preview");
  }

  function send(formData: FormData) {
    if (!blob.current) return;
    formData.set("photo", new File([blob.current], "preuve.jpg", { type: "image/jpeg" }));
    action(formData);
  }

  if (state.ok) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-serif text-4xl">{t.sent}</p>
        <p className="text-mute">{state.message}</p>
        <Link href={backHref} replace className={btnPrimary}>
          {m.app.timer.finish}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-4xl leading-tight text-balance">{title}</h1>
      <p className="text-sm leading-relaxed text-mute">{detail}</p>

      {phase === "camera" ? (
        <div className="aspect-[3/4] w-full animate-fade overflow-hidden rounded-xs bg-surface">
          <video ref={attachVideo} playsInline muted autoPlay className="h-full w-full object-cover" />
        </div>
      ) : null}
      {phase === "preview" && preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), jamais envoyé ailleurs qu'au serveur
        <img src={preview} alt={t.preview} className="w-full animate-fade rounded-xs" />
      ) : null}

      {phase === "intro" && mode === "camera" ? (
        <button type="button" onClick={openCamera} className={btnPrimary}>
          {t.openCamera}
        </button>
      ) : null}
      {phase === "intro" && mode === "file" ? (
        <label className={`${btnPrimary} cursor-pointer`}>
          {t.chooseCapture}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
        </label>
      ) : null}
      {phase === "camera" ? (
        <button type="button" onClick={capture} className={btnPrimary}>
          {t.takePhoto}
        </button>
      ) : null}
      {phase === "preview" ? (
        <form action={send} className="space-y-3">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="targetId" value={targetId} />
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? m.common.actions.sending : t.sendPhoto}
          </button>
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              blob.current = null;
              if (mode === "camera") void openCamera();
              else setPhase("intro");
            }}
            className={`${btnSecondary} w-full`}
          >
            {mode === "camera" ? t.retake : t.chooseOther}
          </button>
        </form>
      ) : null}
      {phase === "denied" ? <p role="alert">{t.cameraDenied}</p> : null}
      {state.message ? (
        <p role="alert" className="text-sm">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
