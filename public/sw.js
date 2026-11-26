// Network first, cache as fallback: online players always get the latest build,
// offline players get the last version they loaded.
const CACHE_NAME = 'coda-shmup-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    // The leaderboard is live data: never served from the cache
    if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/'))
        return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            })
            .catch(() => caches.match(request).then((cached) => cached ?? Response.error()))
    );
});
