// Kabbo Digital Ledger — Service Worker v4
// Upgrade from v3 (no caching) → offline-capable:
//  - App shell + hashed Vite assets cached (offline reload works)
//  - Navigations: network-first, fallback to cached shell when offline
//  - Firebase/Google traffic untouched (Firestore SDK handles its own offline)
const SW_VERSION = "v4";
const CACHE = "kabbo-ledger-" + SW_VERSION;
const SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept Firebase / Google APIs
  if (/googleapis\.com|gstatic\.com|firebaseapp\.com|firebaseio\.com|firebasestorage|firebasedatabase/.test(url.hostname)) return;

  // SPA navigations: network first → cached shell offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Same-origin static assets (Vite hashed): cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && (url.pathname.startsWith("/assets/") || /\.(js|css|png|svg|woff2?)$/.test(url.pathname))) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
