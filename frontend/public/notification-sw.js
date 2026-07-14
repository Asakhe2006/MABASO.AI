const STATIC_CACHE_NAME = "mabaso-static-v2";

function shouldCacheStaticRequest(request) {
  if (request.method !== "GET") return false;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith("/assets/")
    || url.pathname.startsWith("/voice-vad/")
    || /\.(?:css|js|mjs|woff2?|ttf|png|jpg|jpeg|webp|svg|ico|xml|txt)$/i.test(url.pathname)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await self.caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith("mabaso-static-") && cacheName !== STATIC_CACHE_NAME)
        .map((cacheName) => self.caches.delete(cacheName)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (!shouldCacheStaticRequest(event.request)) return;

  event.respondWith((async () => {
    const cache = await self.caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(event.request);
    const fetchPromise = fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        cache.put(event.request, networkResponse.clone()).catch(() => {});
      }
      return networkResponse;
    });
    return cachedResponse || fetchPromise;
  })());
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
