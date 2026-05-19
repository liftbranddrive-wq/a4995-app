/* ============================================================
   A $49.95 — Service Worker
   Strategy:
     - Pre-cache app shell on install
     - Network-first for HTML (so updates show up immediately)
     - Cache-first for everything else (icons, css, js, manifest)
   IMPORTANT: bump CACHE_VERSION whenever you change app files
   so users get the update next time they open the app.
   ============================================================ */

const CACHE_VERSION = 'a4995-v6';
const APP_SHELL = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.webmanifest',
    './icons/a4995-logo.webp',
    './icons/favicon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            // Use addAll with a swallow-error fallback so a missing icon
            // doesn't break the whole install.
            return Promise.all(
                APP_SHELL.map((url) =>
                    cache.add(url).catch((err) => {
                        console.warn('[SW] Skipping cache for', url, err);
                    })
                )
            );
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== CACHE_VERSION)
                    .map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Don't try to cache tel:, mailto:, or cross-origin analytics requests.
    if (url.origin !== self.location.origin) return;

    const isHTML =
        req.mode === 'navigate' ||
        (req.headers.get('accept') || '').includes('text/html');

    if (isHTML) {
        // Network-first for HTML so content stays fresh.
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
                    return res;
                })
                .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
        );
        return;
    }

    // Cache-first for assets.
    event.respondWith(
        caches.match(req).then((cached) => {
            if (cached) return cached;
            return fetch(req)
                .then((res) => {
                    if (!res || res.status !== 200 || res.type !== 'basic') return res;
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
                    return res;
                })
                .catch(() => cached);
        })
    );
});
