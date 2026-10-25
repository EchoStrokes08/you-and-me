// Manejo de fotos y videos de los recuerdos: comprimir en el celular antes de subir (1600 px JPEG,
// videos hasta 50 MB por límite del bucket), guardarlos en Storage y borrarlos con el recuerdo.
// Lo usan la pantalla Historia y su formulario; MAX_FOTOS y MAX_VIDEOS son los topes por recuerdo.
import { supabase } from './supabase';
import { comprimirVideo, puedeComprimirVideo } from './video';
import { borrarArchivos, subirArchivo, urlsFirmadas as firmar } from './archivos';

export type Foto = { id: string; ruta: string; url: string; orden: number; tipo: 'foto' | 'video'; favorita: boolean };

export const MAX_FOTOS = 15;
export const MAX_VIDEOS = 5;
// El bucket acepta hasta 50 MB por archivo (migración 020)
export const MAX_MB_VIDEO = 50;
// Lo que se puede escoger: si el celular comprime, un video más pesado igual cabe después de comprimirlo
export const maxMbVideoAElegir = () => (puedeComprimirVideo() ? 300 : MAX_MB_VIDEO);

export const esVideo = (f: File) => f.type.startsWith('video/');

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

// Sube las fotos y videos de un recuerdo empezando en `orden`. Devuelve cuántos fallaron.
// Las fotos y los videos se comprimen en el celular antes de subir; `onEstado` cuenta cómo va un video.
export async function subirFotos(recuerdoId: string, archivos: File[], orden = 0, onEstado?: (texto: string) => void): Promise<number> {
  let fallidas = 0;
  const videos = archivos.filter(esVideo).length;
  let n = 0;
  for (const f of archivos) {
    const video = esVideo(f);
    if (video) n++;
    const cual = videos > 1 ? ` ${n} de ${videos}` : '';
    const blob = video
      ? await comprimirVideo(f, (p) => onEstado?.(`Achicando video${cual}… ${Math.round(p * 100)} %`))
      : await comprimir(f);
    if (video) onEstado?.(`Subiendo video${cual}…`);
    if (blob.size > MAX_MB_VIDEO * 1024 * 1024) { fallidas++; continue; }
    const comprimido = video && blob !== f;
    const ext = comprimido ? 'mp4' : video ? (f.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4' : 'jpg';
    const ruta = `${recuerdoId}/${Date.now()}-${orden}.${ext}`;
    const { error: e1 } = await subirArchivo('recuerdos', ruta, blob, blob.type || (video ? 'video/mp4' : 'image/jpeg'));
    if (e1) { fallidas++; continue; }
    const { error: e2 } = await supabase.from('fotos_recuerdo').insert({ recuerdo_id: recuerdoId, ruta, orden: orden++, tipo: video ? 'video' : 'foto' });
    if (e2) { fallidas++; await borrarArchivos('recuerdos', [ruta]).catch(() => {}); }
  }
  return fallidas;
}

// Borra archivos y filas. Cuando las reglas no dejan borrar no hay error: solo vuelven
// menos archivos de los pedidos, así que se compara la cantidad.
export async function borrarFotos(fotos: { id: string; ruta: string }[]): Promise<boolean> {
  if (!fotos.length) return true;
  const borradas = await borrarArchivos('recuerdos', fotos.map((f) => f.ruta)).catch(() => null);
  if (!borradas || borradas.length < fotos.length) return false;
  const { error: e2 } = await supabase.from('fotos_recuerdo').delete().in('id', fotos.map((f) => f.id));
  return !e2;
}

// URLs firmadas de varias fotos en una sola llamada
export const urlsFirmadas = (rutas: string[], segundos = 3600) => firmar('recuerdos', rutas, segundos);
