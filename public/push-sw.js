// Se carga dentro del service worker (vite.config.ts → workbox.importScripts)
self.addEventListener('push', (event) => {
  const d = event.data ? event.data.json() : {};
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(d.titulo || 'You & me 💚', {
        body: d.cuerpo || '',
        icon: '/pwa-192.png',
        tag: d.tag,
        data: { url: d.url || '/' },
      }),
      // Un puntico en el ícono: al abrir la app se cambia por el número de cosas pendientes
      self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : null,
    ]),
  );
});

// Compartir a la app desde otra (manifest → share_target). Fotos y videos van a un recuerdo nuevo;
// un link de música, a Canciones; cualquier otro texto, a los planes de Juntos.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.origin !== self.location.origin || url.pathname !== '/compartir') return;
  event.respondWith((async () => {
    try {
      const datos = await event.request.formData();
      const archivos = datos.getAll('archivos').filter((a) => typeof a !== 'string' && a.size > 0);
      if (archivos.length) {
        await caches.delete('compartido');
        const cache = await caches.open('compartido');
        await Promise.all(archivos.map((a, i) => cache.put(`/compartido/${i}`, new Response(a, {
          headers: { 'content-type': a.type || 'application/octet-stream', 'x-nombre': encodeURIComponent(a.name || `compartida-${i}`) },
        }))));
        return Response.redirect('/historia?compartido=1', 303);
      }
      const texto = [datos.get('title'), datos.get('text'), datos.get('url')].filter(Boolean).join(' ').trim();
      const link = (texto.match(/https?:\/\/\S+/) || [])[0];
      if (link && /spotify\.com|youtu\.?be|music\.apple\.com|deezer\.com/.test(link)) {
        return Response.redirect(`/juntos?tab=canciones&link=${encodeURIComponent(link)}`, 303);
      }
      return Response.redirect(texto ? `/juntos?texto=${encodeURIComponent(texto.slice(0, 120))}` : '/', 303);
    } catch {
      return Response.redirect('/', 303);
    }
  })());
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
