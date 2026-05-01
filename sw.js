const CACHE_NAME = 'ercan-v22';

self.addEventListener('install', (e) => {
    self.skipWaiting(); // Anında yeni versiyona geç
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(['/', '/index.html', '/css/style.css', '/js/app.js', '/icon.svg', '/manifest.json']);
        })
    );
});

self.addEventListener('activate', (e) => {
    // Eski önbellekleri sil (Böylece telefondaki eski siteleri temizleriz)
    e.waitUntil(caches.keys().then(keys => {
        return Promise.all(keys.map(key => {
            if(key !== CACHE_NAME) return caches.delete(key);
        }));
    }));
});

self.addEventListener('fetch', (e) => {
    // Network-First (Önce internetten güncelini çek, çekemezsen cache'den ver)
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
