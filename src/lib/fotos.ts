import { supabase } from './supabase';

export type Foto = { id: string; ruta: string; url: string; orden: number };

export const MAX_FOTOS = 10;

// Reduce la foto a 1600 px de lado y JPEG 80 %. Si el navegador no la puede leer
// (p. ej. HEIC en algunos Android), se sube tal cual en vez de quedarse esperando.
export async function comprimir(file: File): Promise<Blob> {
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = src;
    await new Promise((ok, falla) => { img.onload = ok; img.onerror = falla; });
    const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = img.width * escala;
    canvas.height = img.height * escala;
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
    return blob ?? file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(src);
  }
}

// Sube las fotos de un recuerdo empezando en `orden`. Devuelve cuántas fallaron.
export async function subirFotos(recuerdoId: string, archivos: File[], orden = 0): Promise<number> {
  let fallidas = 0;
  for (const f of archivos) {
    const blob = await comprimir(f);
    const ruta = `${recuerdoId}/${Date.now()}-${orden}.jpg`;
    const { error: e1 } = await supabase.storage.from('recuerdos').upload(ruta, blob, { contentType: blob.type || 'image/jpeg' });
    if (e1) { fallidas++; continue; }
    const { error: e2 } = await supabase.from('fotos_recuerdo').insert({ recuerdo_id: recuerdoId, ruta, orden: orden++ });
    if (e2) { fallidas++; await supabase.storage.from('recuerdos').remove([ruta]); }
  }
  return fallidas;
}

// Borra archivos y filas. Storage no da error cuando RLS no deja borrar: solo devuelve
// menos archivos de los pedidos, así que se compara la cantidad.
export async function borrarFotos(fotos: { id: string; ruta: string }[]): Promise<boolean> {
  if (!fotos.length) return true;
  const { data, error } = await supabase.storage.from('recuerdos').remove(fotos.map((f) => f.ruta));
  if (error || (data?.length ?? 0) < fotos.length) return false;
  const { error: e2 } = await supabase.from('fotos_recuerdo').delete().in('id', fotos.map((f) => f.id));
  return !e2;
}

// URLs firmadas de varias fotos en una sola llamada
export async function urlsFirmadas(rutas: string[], segundos = 3600): Promise<Record<string, string>> {
  if (!rutas.length) return {};
  const { data } = await supabase.storage.from('recuerdos').createSignedUrls(rutas, segundos);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}
