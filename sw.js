// Service worker Dompet Pintar: bikin app bisa dibuka cepat dan tetap tampil saat offline.
// Naikkan VERSION setiap kali kamu mengubah index.html supaya pengguna dapat versi terbaru.
const VERSION = 'v1';
const CACHE = `dompet-pintar-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png'
];

// Hanya aset statis dari host ini yang boleh di-cache. Data Firestore/Auth tidak pernah disentuh.
const STATIC_HOSTS = [
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dompet-pintar-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Halaman utama: coba jaringan dulu (selalu terbaru), jatuh ke cache kalau offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // File di folder sendiri: cache dulu, update di belakang layar.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Library/font dari CDN: cache dulu, update di belakang layar.
  if (STATIC_HOSTS.includes(url.hostname) && !url.pathname.includes('/firestore/') ) {
    event.respondWith(staleWhileRevalidate(req));
  }
  // Selain itu (API Firestore, Auth, dll.) langsung ke jaringan, tidak di-cache.
});

function staleWhileRevalidate(req) {
  return caches.open(CACHE).then((cache) =>
    cache.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}
