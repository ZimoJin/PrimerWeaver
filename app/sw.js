// sw.js - PrimerWeaver App Service Worker
// Scope: /app/
// Goal: speed up repeat visits + module switching by serving assets from Cache Storage.

// Bump cache version to ensure updated assets are picked up immediately.
const CACHE_NAME = 'primerweaver-app-v1.1.11';

// Keep install lightweight to avoid blocking first load.
const SHELL_ASSETS = [
  './app-index.html',
  './app-style.css',
  './app-main.js',
  './app-module-loader.js'
];

// Cached after first render (via postMessage), so it doesn't compete with first paint.
const PRECACHE_ASSETS = [
  './modules/Gibson_V1.0.1.html',
  './modules/Golden_Gate_v1.0.1.html',
  './modules/oe_pcr_v1.0.1.html',
  './modules/USER_V1.0.1.html',
  './modules/QC_V1.0.1.html',
  './modules/RE_cloning_v1.0.1.html',
  './modules/mutagenesis_v1.0.1.html',
  './modules/multiplex_pcr_v1.0.1.html',

  './modules/scripts/core_v1.0.1.js',
  './modules/scripts/bio_visuals_v1.0.1.js',
  './modules/scripts/codon_v1.0.1.js',
  './modules/scripts/common_features_v1.0.1.js',
  './modules/scripts/golden_gate_v1.0.1.js',
  './modules/scripts/gibson_v1.0.1.js',
  './modules/scripts/oe_pcr_v1.0.1.js',
  './modules/scripts/user_cloning_v1.0.1.js',
  './modules/scripts/mutagenesis_v1.0.1.js',
  './modules/scripts/multiplex_pcr_v1.0.1.js',
  './modules/scripts/qc_v1.0.1.js',
  './modules/scripts/re_cloning_v1.0.1.js',

  './modules/contents/demo/Golden_Gate_vector.txt',
  './modules/contents/demo/pESC-His.txt',
  './modules/contents/demo/Insert_1.txt',
  './modules/contents/demo/Insert_2.txt',
  './modules/contents/demo/Insert_3.txt',
  './modules/contents/demo/Insert_4.txt',
  './modules/contents/demo/Insert_5.txt',
  './modules/contents/demo/Insert_6.txt',
  './modules/contents/demo/multiplex_fragment.txt',
  './modules/contents/demo/multiplex_primer_pool.txt'
];

async function cacheAddAllSafe(cache, urls) {
  await Promise.all(urls.map(async (url) => {
    try {
      await cache.add(url);
    } catch {
      // Ignore individual failures (file missing on a given deployment, etc.)
    }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cacheAddAllSafe(cache, SHELL_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'PRECACHE_ALL') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      await cacheAddAllSafe(cache, PRECACHE_ASSETS);

      try {
        // Acknowledge completion so the page can decide whether to navigate immediately.
        if (event.source && event.source.postMessage) {
          event.source.postMessage({ type: 'PRECACHE_DONE', requestId: data.requestId || null });
        }
      } catch {}
    })());
  }
});

// Cache strategy for same-origin GET requests under /app/
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Only handle app assets (avoid interfering with the main site shell).
  if (!url.pathname.includes('/app/')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    const path = url.pathname.toLowerCase();
    const isCritical =
      req.destination === 'document' ||
      req.destination === 'style' ||
      req.destination === 'script' ||
      path.endsWith('.html') ||
      path.endsWith('.css') ||
      path.endsWith('.js');

    // Network-first for HTML/CSS/JS so edits show up immediately (especially during local development).
    if (isCritical) {
      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch (e) {
        const cached = await cache.match(req, { ignoreSearch: true });
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    }

    // Stale-while-revalidate for everything else (fast + keeps cache warm).
    const cached = await cache.match(req, { ignoreSearch: true });
    const fetchPromise = fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      })
      .catch(() => null);

    return cached || (await fetchPromise) || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
