/* Kabbo Digital Ledger — Service Worker v2
 * Fixes: /sw.js was being redirected to index.html (fake SW, offline broken).
 * Strategy:
 *  - App shell (HTML/CSS/JS/manifest): stale-while-revalidate
 *  - Firestore/Google APIs: network only (Firestore SDK has its own offline cache)
 *  - Navigation fallback: cached index.html when offline
 */
const CACHE = "kabbo-ledger-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // Never intercept Firebase/Google traffic — SDK handles its own offline persistence
  if (/googleapis\.com|firebaseio\.com|firebaseapp\.com|gstatic\.com|firebasedatabase\.app/.test(url.hostname)) return;

  // SPA navigations: network first, fall back to cached shell when offline
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets (hashed by Vite): cache first, then network
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
            }
            return res;
          })
      )
    );
  }
});
