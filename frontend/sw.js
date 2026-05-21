const CACHE = 'fazja-v1';
const STATIC = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Never cache API requests
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});

self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'Faz Já', {
      body:              data.body  || '',
      icon:              '/icon.svg',
      badge:             '/icon.svg',
      tag:               data.tag   || 'fazja-notif',
      data:              data.data  || {},
      requireInteraction: true,
      vibrate:           [200, 100, 200],
      actions: [
        { action: 'done',   title: '✓ Feito' },
        { action: 'snooze', title: '⏰ +15min' },
      ],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const taskId = e.notification.data?.taskId;

  if (e.action === 'done' && taskId) {
    e.waitUntil(
      fetch(`/api/tasks/${taskId}/done`, { method: 'PUT' })
        .then(() => clients.matchAll({ type: 'window' }))
        .then(cls => cls.forEach(c => c.postMessage({ type: 'RELOAD' })))
    );
  } else {
    e.waitUntil(
      clients.matchAll({ type: 'window' }).then(cls => {
        if (cls.length) { cls[0].focus(); return; }
        clients.openWindow('/');
      })
    );
  }
});
