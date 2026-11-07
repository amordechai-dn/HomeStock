/* Service worker: precache + cache-first, offline-capable, self-updating.
   Bump VERSION on every deploy to trigger an update for installed PWAs. */
var VERSION = 'v4.3.62';
var CACHE_PREFIX = 'homestock:' + self.registration.scope + ':';
var CACHE = CACHE_PREFIX + VERSION;

// Critical-path assets for first paint + full offline. Kept lean: only what
// the app needs to boot and run offline. Runtime API responses (Open Food
// Facts lookups) are NOT cached here — they are persisted per-user in the
// IndexedDB `barcodes` store, so there is no duplicate/redundant caching.
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './design.css',
  './workspace.css',
  './responsive.css',
  './brand.js',
  './barcode.js',
  './voice.js',
  './icons/icon.svg',
  './icons/logo-mark.svg',
  './icons/logo-mark-light.svg',
  './home-model.js',
  './fonts/Rubik.ttf',
  './config.js',
  './i18n.js',
  './db.js',
  './auth.js',
  './app.js',
  './sync/github-sync.js',
  './dropdown.js',
  './pwa.js',
  // Scanner library: precached so the lazy load (on first scanner open) still
  // resolves from cache offline, but it is NOT on the startup/parse path.
  './vendor/zxing.min.js',
  './data/foods.js',
  './manifest.webmanifest',
  './icons/icon-16.png',
  './icons/icon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon-180.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        // Fetch one complete release, bypassing browser/CDN entries from an
        // older deployment. Store canonical keys for offline asset lookup.
        return Promise.all(ASSETS.map(function (path) {
          var canonical = new URL(path, self.registration.scope).href;
          var fresh = new URL(canonical);
          fresh.searchParams.set('__release', VERSION);
          return fetch(new Request(fresh.href, { cache: 'reload' }))
            .then(function (response) {
              if (!response.ok) throw new Error('Precache failed: ' + path);
              return cache.put(canonical, response);
            });
        }));
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            if (key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE) return caches.delete(key);
            return null;
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || req.url.indexOf(self.registration.scope) !== 0) return;

  event.respondWith(caches.open(CACHE).then(function (cache) {
    // Never search other releases or other GitHub Pages apps' caches.
    return cache.match(req, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;
      return fetch(req).catch(function (err) {
        if (req.mode === 'navigate') return cache.match(new URL('./index.html', self.registration.scope).href);
        throw err;
      });
    });
  }));
});

self.addEventListener('message', function (event) {
  var data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: VERSION });
  }
});
