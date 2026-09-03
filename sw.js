const CACHE_NAME = 'petwalker-v28';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './src/app.v5.js',
  './src/app.v5.js?v=28',
  './src/domain/models.js',
  './src/services/storage.js',
  './src/services/security.js',
  './src/services/googleSync.js',
  './src/services/pushService.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-512-maskable.png',
  './assets/apple-touch-icon.png',
  './assets/favicon.svg',
  './assets/favicon-32x32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Dynamic Cache for Google Fonts
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => new Response('', { status: 408, statusText: 'Offline Font Fallback' }));
      })
    );
    return;
  }

  // App Assets: Stale-while-revalidate / Network-First with Safe Offline Fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // Fallback for navigation requests (HTML)
        if (event.request.mode === 'navigate') {
          const fallbackHtml = await caches.match('./index.html');
          if (fallbackHtml) return fallbackHtml;
        }

        return new Response('Offline', { status: 503, statusText: 'Offline' });
      })
  );
});

// Listener de Web Push Oficial (Apple APNs / Google FCM)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: '🔔 Alerta Petwalker', body: event.data.text() };
    }
  }

  const title = data.title || '🔔 Alerta de Passeio!';
  const options = {
    body: data.body || 'Aviso do Petwalker.',
    icon: 'assets/icon-192.png',
    badge: 'assets/favicon-32x32.png',
    vibrate: [300, 150, 300, 150, 300],
    tag: data.tag || 'walk-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: './', sessionId: data.sessionId }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});
