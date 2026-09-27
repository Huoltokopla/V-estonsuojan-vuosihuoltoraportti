const CACHE = 'vss-vuosihuolto-v2';

// Vain sovelluksen omat staattiset tiedostot välimuistiin.
// Microsoftin kirjautumis- ja token-pyyntöjä ei käsitellä service workerilla.
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './msal-browser.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Älä sieppaa Microsoft Entra / MSAL -liikennettä tai muuta ulkoista liikennettä.
  if (url.origin !== self.location.origin) return;

  // Sivun navigoinnissa suositaan verkkoa, jotta uusi index.html ja
  // kirjautumiskoodi tulevat käyttöön eivätkä jää vanhaan cacheen.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Muut oman sovelluksen staattiset tiedostot: cache ensin, verkko varalla.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
