/* The 5:15 Log service worker: app shell cached for offline use.
   Bump VERSION on every release so phones pick up the update. */
const VERSION = "515-v2";
const FONT_CACHE = "515-fonts";
const SHELL = [
  "./", "index.html", "styles.css", "app.js", "manifest.webmanifest",
  "vendor/html5-qrcode.min.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== FONT_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => { if (event.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App files: cache first, network fallback. Navigations always get the cached shell.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      if (req.mode === "navigate") return (await cache.match("index.html")) || fetch(req);
      return (await cache.match(req, { ignoreSearch: true })) || fetch(req);
    })());
    return;
  }

  // Google Fonts: serve cached, refresh in the background.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })());
  }
  // Food databases: always live, never cached by the worker.
});
