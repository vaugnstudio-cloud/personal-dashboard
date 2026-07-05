/* Vaugn Studio service worker — offline app shell.
   Navigations are network-first (always-fresh HTML, cache fallback offline).
   Subresources are cache-first with background refresh.
   Redirected responses are re-wrapped before caching: serving a redirected
   response for a navigation is forbidden and error-pages the tab. */
const CACHE = 'studioos-v4';
const SHELL = [
  './',
  './index.html',
  './crm.html',
  './reports.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/css/styles.css',
  './assets/js/data.js',
  './assets/js/store.js',
  './assets/js/sheets-sync.js',
  './assets/js/history.js',
  './assets/js/settings.js',
  './assets/js/help.js',
  './assets/js/tour.js',
  './assets/js/app.js',
  './assets/js/sample-data.js',
  './assets/js/crm/crm-data.js',
  './assets/js/crm/crm-store.js',
  './assets/js/crm/crm-table.js',
  './assets/js/crm/crm-app.js',
  './assets/js/reports/charts.js',
  './assets/js/reports/insights.js',
  './assets/js/reports/reports-app.js',
];

/** Strip the `redirected` flag so the response is safe to serve anywhere. */
async function cleanResponse(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: 200, statusText: 'OK', headers: res.headers });
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(SHELL.map(async (url) => {
        try {
          const res = await fetch(url);
          if (res.ok) await c.put(url, await cleanResponse(res));
        } catch (err) { /* offline install — skip */ }
      }))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;

  // Navigations: network-first so deploys show up immediately; cache when offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(async (res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(e.request, { ignoreSearch: true })
            .then((r) => r || caches.match('./index.html'))
            .then((r) => r || caches.match('./'))
        )
    );
    return;
  }

  // Local JS/CSS: network-first so code fixes reach users immediately after a
  // deploy; fall back to cache only when offline.
  if (/\.(?:js|css)$/.test(new URL(e.request.url).pathname)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Other subresources (fonts, icons): cache-first, refresh in the background.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request)
        .then(async (res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
