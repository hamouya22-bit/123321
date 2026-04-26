const CACHE_NAME = 'abg-cache-v6';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/logoapp.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Ignora le richieste in POST, estensioni chrome ecc..
  if (e.request.method !== 'GET') return;
  
  // Ignora completamente le richieste a Supabase: network only per il db
  if (e.request.url.includes('supabase.co')) {
    e.respondWith(fetch(e.request));
    return;
  }
  
  // Cache First per gli asset statici (HTML, CSS, JS, immagini)
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(response => {
        // Opzionale: aggiungi alla cache se file validi
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(e.request, response.clone());
          return response;
        });
      });
    }).catch(() => caches.match('/index.html'))
  );
});
