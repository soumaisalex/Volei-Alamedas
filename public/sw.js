// Service worker: recebe as notificações push e abre o app ao tocar nelas.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data.json(); } catch { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Vôlei Alamedas', {
    body: d.body || '',
    icon: '/icon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    lang: 'pt-BR',
    data: { ir: d.ir || 'inicio' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ir = event.notification.data?.ir || 'inicio';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.length) {
      await wins[0].focus();
      wins[0].postMessage({ type: 'ir', ir });
    } else {
      await self.clients.openWindow(`/?ir=${ir}`);
    }
  })());
});
