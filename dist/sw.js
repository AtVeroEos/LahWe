// Lah We service worker — only in play when the app is served over http(s) next to this file.
// Opened as a plain local file, the app never registers it and works exactly the same online.
const BUILD = '3.22.1-e849181482';
const SHELL = 'lahwe-shell-' + BUILD;      // the app itself; replaced on every release
const RUNTIME = 'lahwe-runtime-v1';        // the barcode library, fetched on first use
const FORM = 'lahwe-form-v1';              // exercise photos: never change (pinned commit), so kept once fetched
const FORM_MAX = 400;                      // about 25 MB; the oldest go first
const PRECACHE = ['./', 'index.html', 'lahwe.html', 'zxing.min.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const RUNTIME_HOSTS = ['cdn.jsdelivr.net'];

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
        // A page address carrying a query (a sign-in coming back) is never stored.
        if (fresh && fresh.ok && !url.search) cache.put(req, fresh.clone());
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
  // Exercise photos: the address pins one commit, so a saved copy is always right. Cache first, no refresh.
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/gh/yuhonas/free-exercise-db@')) {
    event.respondWith((async () => {
      const cache = await caches.open(FORM);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok) { // CORS responses only: an opaque one is charged megabytes of quota
          await cache.put(req, res.clone());
          const keys = await cache.keys();
          if (keys.length > FORM_MAX) await Promise.all(keys.slice(0, keys.length - FORM_MAX).map(k => cache.delete(k)));
        }
        return res;
      } catch (e) { return Response.error(); }
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
