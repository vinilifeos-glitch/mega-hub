/* Mega Hub push service worker (copied to dist/sw.js on deploy). */
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let data = { title: 'Mega Hub', body: 'You have a rota update.', url: './' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {
    try { data.body = event.data.text(); } catch (_) {}
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Mega Hub', {
    body: data.body || '',
    tag: data.tag || 'megahub-rota',
    renotify: true,
    data: { url: data.url || './' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { c.navigate && c.navigate(url); return c.focus(); } }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
