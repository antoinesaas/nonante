"use client";

import { useEffect, useState } from "react";
import { btnSecondary } from "@/lib/ui";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Installation de la PWA : bouton sur Android et Chrome, mode d'emploi sur iPhone. */
export function InstallHint() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // Lecture de l'environnement du navigateur, possible seulement après le montage.
    const timer = setTimeout(() => {
      setStandalone(window.matchMedia("(display-mode: standalone)").matches);
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    }, 0);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(timer);
    };
  }, []);

  if (standalone) return null;
  return (
    <div className="mt-6 border-t border-line pt-6 text-sm">
      <p>Installe Nonante sur ton écran d&apos;accueil.</p>
      {prompt ? (
        <button
          type="button"
          onClick={async () => {
            await prompt.prompt();
            setPrompt(null);
          }}
          className={`${btnSecondary} mt-3`}
        >
          Installer
        </button>
      ) : ios ? (
        <p className="mt-2 text-mute">Dans Safari : bouton Partager, puis « Sur l&apos;écran d&apos;accueil ».</p>
      ) : (
        <p className="mt-2 text-mute">Menu du navigateur, puis « Installer l&apos;application ».</p>
      )}
    </div>
  );
}
