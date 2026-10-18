// Offline cache for the app shell. API calls (Groq, Aladhan) always go to the network.
const CACHE = 'ascend90-v2';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/main.js', 'js/views.js', 'js/game.js', 'js/ai.js', 'js/store.js', 'js/data.js', 'js/prayer.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];
const CDN = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Own files: network first so updates land, cache as offline fallback.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(res => { caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })
        .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
    );
    return;
  }
  // Fonts and icon library: cache first.
  if (CDN.includes(url.hostname)) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }))
    );
  }
});
