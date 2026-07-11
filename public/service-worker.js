// v1 - caches the static app shell only. Firestore traffic (firestore.googleapis.com,
// the real-time sync channel) is never intercepted here, and must never be - the whole
// point of this app is that manager/staff writes reach Firestore directly and instantly.
const CACHE_NAME = 'kabbo-shell-v1';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache/intercept API, Firebase, or Netlify function calls.
  if (
    event.request.method !== 'GET' ||
    url.origin.includes('googleapis') ||
    url.origin.includes('firebaseio') ||
    url.origin.includes('firestore') ||
    url.pathname.startsWith('/.netlify/')
  ) {
    return;
  }

  // Network-first for navigations so a stale shell never masks a real deploy.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for built assets (immutable, hashed filenames).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      }))
    );
  }
});
