const CACHE_NAME = 'hc-garden-v4';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        await cache.addAll(URLS);
      } catch (err) {
        console.warn('[SW] Some files failed to cache, continuing anyway');
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (e.request.method !== 'GET') return;

  if (url.hostname.includes('imgur.com')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});

const URLS = [
  ".nojekyll",
  "README.md",
  "assets/maps/map_all.png",
  "assets/fauna.jpg",
  "assets/flora.jpg",
  "assets/homeimage.jpg",
  "assets/fonts/google/flUhRq6tzZclQEJ-Vdg-IuiaDsNZ.ttf",
  "assets/fonts/google/lato.css",
  "assets/fonts/google/material-icons.css",
  "assets/fonts/google/S6u_w4BMUTPHjxsI5wqPHA.ttf",
  "assets/fonts/google/S6u_w4BMUTPHjxsI9w2PHA.ttf",
  "assets/fonts/google/S6u8w4BMUTPHjxswWw.ttf",
  "assets/fonts/google/S6u9w4BMUTPHh6UVew8.ttf",
  "assets/fonts/google/S6u9w4BMUTPHh7USew8.ttf",
  "assets/fonts/google/S6uyw4BMUTPHvxk.ttf",
  "assets/fonts/Precious.ttf",
  "assets/images/fauna.jpg",
  "assets/images/flora.jpg",
  "assets/images/homeimage.jpg",
  "css/leaflet.css",
  "css/styles.css",
  "data.json",
  "index.html",
  "js/alpine.min.js",
  "js/app.js",
  "js/components/clickable-image.js",
  "js/components/ff-entry.js",
  "js/components/ff-list.js",
  "js/components/filter-modal.js",
  "js/components/lightbox.js",
  "js/components/overview.js",
  "js/components/sidebar.js",
  "js/leaflet.js",
  "js/map.js",
  "js/service-worker.js",
  "js/tailwind.js",
  "js/utils.js",
  "manifest.json",
  "templates/home.html",
  "templates/introduction.html",
  "templates/map.html",
  "templates/overview.html",
  "templates/flora-fauna.html",
  "templates/species.html",
  "templates/history.html",
  "templates/committee-message.html",
  "templates/acknowledgements.html",
  "templates/references.html"
];
