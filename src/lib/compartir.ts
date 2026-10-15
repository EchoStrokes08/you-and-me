// Lo que se comparte a la app desde otra (galería, Spotify…) llega por el service worker
// (public/push-sw.js): las fotos y videos quedan en este caché hasta que Historia los recoge.
export const CACHE_COMPARTIDO = 'compartido';

export async function leerCompartidos(): Promise<File[]> {
  if (!('caches' in window)) return [];
  try {
    const cache = await caches.open(CACHE_COMPARTIDO);
    const pedidos = await cache.keys();
    const archivos: File[] = [];
    for (const p of pedidos) {
      const r = await cache.match(p);
      if (!r) continue;
      const blob = await r.blob();
      const nombre = decodeURIComponent(r.headers.get('x-nombre') ?? 'compartida');
      archivos.push(new File([blob], nombre, { type: blob.type || r.headers.get('content-type') || '' }));
    }
    await caches.delete(CACHE_COMPARTIDO);
    return archivos;
  } catch {
    return [];
  }
}
