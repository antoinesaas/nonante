import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Services de notification des navigateurs. Le serveur n'envoie jamais rien ailleurs (pas de SSRF).
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  ".push.apple.com",
  ".notify.windows.com",
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    return PUSH_HOSTS.some((h) => (h.startsWith(".") ? url.hostname.endsWith(h) : url.hostname === h));
  } catch {
    return false;
  }
}

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

export type PushPayload = { title: string; body: string; url: string };

/** Envoie à tous les appareils de l'utilisateur. Renvoie true si au moins un l'a reçue. */
export async function sendPush(userId: string, payload: PushPayload): Promise<boolean> {
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const admin = createAdminClient();
  const { data: targets } = await admin.rpc("push_targets", { p_user: userId });
  let delivered = false;
  for (const target of targets ?? []) {
    if (!isAllowedPushEndpoint(target.endpoint)) continue;
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
        { TTL: 6 * 3600 },
      );
      delivered = true;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // Abonnement expiré ou révoqué.
      if (status === 404 || status === 410) {
        await admin.rpc("delete_push_endpoint", { p_endpoint: target.endpoint });
      }
    }
  }
  return delivered;
}
