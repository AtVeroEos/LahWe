// Lah We service worker — only in play when the app is served over http(s) next to this file.
// Opened as a plain local file, the app never registers it and works exactly the same online.
const BUILD = '3.0.0-391cfa20eb';
const SHELL = 'lahwe-shell-' + BUILD;      // the app itself; replaced on every release
const RUNTIME = 'lahwe-runtime-v1';        // fonts and the barcode library, fetched on first use
const PRECACHE = ['./', 'index.html', 'lahwe.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // Best effort, one by one: a missing optional file must not block the rest.
    await Promise.all(PRECACHE.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('lahwe-shell-') && n !== SHELL).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // The page: network first so an update shows up on the next launch; the cached copy when offline or slow.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      try {
        const fresh = await withTimeout(fetch(req), 4000);
        if (fresh && fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./')) || (await cache.match('index.html')) || (await cache.match('lahwe.html')) || Response.error();
      }
    })());
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }
  // Fonts and the scanner library: serve the saved copy immediately, refresh it in the background.
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const hit = await cache.match(req);
      const refresh = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await refresh) || Response.error();
    })());
  }
  // Everything else (Open Food Facts, the Claude API) goes straight to the network, never cached.
});
