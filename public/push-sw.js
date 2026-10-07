// Se carga dentro del service worker (vite.config.ts → workbox.importScripts)
self.addEventListener('push', (event) => {
  const d = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(d.titulo || 'You & me 💚', {
      body: d.cuerpo || '',
      icon: '/pwa-192.png',
      tag: d.tag,
      data: { url: d.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (ventanas) => {
      for (const v of ventanas) {
        await v.focus();
        return v.navigate(url).catch(() => v);
      }
      return self.clients.openWindow(url);
    }),
  );
});
