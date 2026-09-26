/* Network-first service worker: the site opens offline (map tiles still need network).
   Bump VERSION whenever you change data.js / app.js / styles.css. */
const VERSION = 'kbh-v5';
const SHELL = ['./', './index.html', './styles.css', './app.js', './data.js', './favicon.svg', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle same-origin + font/leaflet CDN; let map tiles go straight to network.
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|unpkg\.com/.test(url.host);
  if (!cacheable) return;
  // Same-origin files: always revalidate with the server so edits show up immediately (conditional requests are cheap).
  const init = url.origin === location.origin ? { cache: 'no-cache' } : undefined;
  e.respondWith(
    fetch(req, init).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
