self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const data = notification?.data || {};
  const roomId = typeof data.roomId === "string" ? data.roomId : "";
  const targetUrl = typeof data.url === "string" && data.url
    ? data.url
    : `/app/collaboration${roomId ? `?room=${encodeURIComponent(roomId)}&reply=1` : ""}`;

  notification?.close();

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const sameOriginClient = clients.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch {
        return false;
      }
    });

    if (sameOriginClient) {
      await sameOriginClient.focus();
      sameOriginClient.postMessage({
        type: "open-collaboration-reply",
        roomId,
        url: targetUrl,
      });
      return;
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
