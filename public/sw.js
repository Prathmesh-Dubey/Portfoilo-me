// ReuseMe service worker.
// - Pages: network first; when offline, show the last saved copy, otherwise the animated offline screen.
// - Static assets (JS, CSS, fonts, icons, photo): cache first, so saved pages still look right offline.
// - Admin pages and API calls are never cached.
const VERSION = 'reuseme-v1';
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(ASSETS).then((c) => c.addAll([OFFLINE_URL, '/icons/icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isAdmin = url.pathname.startsWith('/admin');
  const isApi = url.pathname.startsWith('/api/');

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !isAdmin) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => (!isAdmin && (await caches.match(req, { ignoreSearch: true }))) || caches.match(OFFLINE_URL)),
    );
    return;
  }

  const cacheable =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/api/photo') ||
    url.pathname.startsWith('/api/uploads/') ||
    /\.(woff2?|png|jpg|jpeg|webp|svg|ico|mjs)$/.test(url.pathname);
  if (!cacheable || (isApi && !url.pathname.startsWith('/api/photo') && !url.pathname.startsWith('/api/uploads/'))) return;

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
