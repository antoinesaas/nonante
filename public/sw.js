// Service worker de Nonante : notifications de rappel et écran hors ligne.
// Aucune mise en cache des pages : les données affichées viennent toujours du serveur.

const OFFLINE_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nonante</title></head><body style="margin:0;background:#0a0a0a;color:#f2f2f2;font:16px/1.5 system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px"><div><p style="font-size:28px;margin:0 0 8px">Hors ligne.</p><p style="color:#8a8a8a;margin:0">Tes preuves partent quand la connexion revient. Minuit, heure de Paris, reste la limite.</p></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Nonante", body: "", url: "/app" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // Charge utile illisible : notification générique.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
      lang: "fr",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/app", self.location.origin);
  // Seulement des pages de Nonante.
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(url.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(url.href);
    }),
  );
});
