"use client";

import { useEffect } from "react";

/** Enregistre le service worker (notifications, écran hors ligne, installation). */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
