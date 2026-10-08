"use client";

import { useI18n } from "@/components/I18nProvider";
import { useState, useTransition } from "react";
import { disablePush, savePushSubscription } from "@/app/actions/profile";
import { btnSecondary } from "@/lib/ui";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Notifications push (Web Push, VAPID). Sur iPhone : seulement une fois l'app ajoutée à l'écran d'accueil. */
export function PushToggle({ subscribed, publicKey }: { subscribed: boolean; publicKey: string | null }) {
  const { m } = useI18n();
  const [on, setOn] = useState(subscribed);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!publicKey) return <p className="mt-4 text-sm text-mute">Notifications pas encore disponibles.</p>;

  function enable() {
    startTransition(async () => {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          setMessage(m.app.profile.pushUnsupported);
          return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setMessage(m.app.profile.pushDenied);
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey!),
          }));
        const r = await savePushSubscription(subscription.toJSON());
        setOn(r.ok);
        setMessage(r.message);
      } catch {
        setMessage(m.app.profile.pushFailed);
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker?.getRegistration("/sw.js");
        await (await registration?.pushManager.getSubscription())?.unsubscribe();
      } catch {
        // L'abonnement côté serveur est supprimé quoi qu'il arrive.
      }
      const r = await disablePush();
      setOn(false);
      setMessage(r.message);
    });
  }

  return (
    <div className="mt-4">
      <button type="button" disabled={pending} onClick={on ? disable : enable} className={btnSecondary}>
        {pending ? "…" : on ? m.app.profile.pushOff : m.app.profile.pushOn}
      </button>
      {message ? (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
