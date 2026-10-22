// Subir, ver y borrar fotos, videos y audios, estén en Supabase o en el almacenamiento externo (api/archivos.ts).
// Mientras configuracion.archivos_en sea 'supabase' todo va directo a Supabase, como siempre. Desde que el admin
// empieza a migrar ('externo'), los nuevos se suben afuera y los enlaces los firma el servidor, que sabe dónde
// está cada uno y respeta las mismas reglas de quién puede ver qué.
import { supabase } from './supabase';

export type Bucket = 'recuerdos' | 'adjuntos';

let donde: Promise<'supabase' | 'externo'> | null = null;
const dondeVan = () => (donde ??= Promise.resolve(supabase.from('configuracion').select('archivos_en').eq('id', 1).single())
  .then(({ data }) => (data?.archivos_en === 'externo' ? 'externo' as const : 'supabase' as const))
  .catch(() => 'supabase' as const));
// Después de migrar desde el panel, para que este celular se entere sin recargar
export const olvidarDondeVan = () => { donde = null; };

export async function pedirAlServidor<T = unknown>(cuerpo: object): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch('/api/archivos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: JSON.stringify(cuerpo),
  });
  const j = await r.json().catch(() => ({ error: 'fallo' }));
  if (!r.ok || j.error) throw new Error(j.error ?? 'fallo');
  return j as T;
}

export async function subirArchivo(bucket: Bucket, ruta: string, blob: Blob, tipo = blob.type): Promise<{ error: Error | null }> {
  if ((await dondeVan()) === 'supabase') {
    const { error } = await supabase.storage.from(bucket).upload(ruta, blob, { contentType: tipo || undefined });
    return { error };
  }
  try {
    const { url } = await pedirAlServidor<{ url: string }>({ accion: 'subir', bucket, ruta, tipo, bytes: blob.size });
    const r = await fetch(url, { method: 'PUT', body: blob, headers: tipo ? { 'Content-Type': tipo } : {} });
    if (!r.ok) {
      await borrarArchivos(bucket, [ruta]).catch(() => {}); // que no quede registrado algo que no subió
      return { error: new Error(`No subió (${r.status})`) };
    }
    return { error: null };
  } catch (e) {
    return { error: e as Error };
  }
}

// Enlaces firmados de varios archivos en una sola llamada: { ruta: url }
export async function urlsFirmadas(bucket: Bucket, rutas: string[], segundos = 3600): Promise<Record<string, string>> {
  if (!rutas.length) return {};
  if ((await dondeVan()) === 'supabase') {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(rutas, segundos);
    const salida: Record<string, string> = Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl!]));
    // Si el admin migró hace un rato y aquí no se ha enterado, lo que falte lo resuelve el servidor
    const faltan = rutas.filter((r) => !salida[r]);
    if (faltan.length) Object.assign(salida, await pedirAlServidor<{ urls: Record<string, string> }>({ accion: 'firmar', bucket, rutas: faltan, segundos }).then((j) => j.urls).catch(() => ({})));
    return salida;
  }
  const salida: Record<string, string> = {};
  for (let i = 0; i < rutas.length; i += 200) {
    const j = await pedirAlServidor<{ urls: Record<string, string> }>({ accion: 'firmar', bucket, rutas: rutas.slice(i, i + 200), segundos }).catch(() => ({ urls: {} }));
    Object.assign(salida, j.urls);
  }
  return salida;
}

export async function urlFirmada(bucket: Bucket, ruta: string, segundos = 3600): Promise<string | null> {
  return (await urlsFirmadas(bucket, [ruta], segundos))[ruta] ?? null;
}

// Devuelve las rutas que de verdad se borraron (las reglas pueden no dejar borrar alguna)
export async function borrarArchivos(bucket: Bucket, rutas: string[]): Promise<string[]> {
  if (!rutas.length) return [];
  if ((await dondeVan()) === 'supabase') {
    const { data, error } = await supabase.storage.from(bucket).remove(rutas);
    if (error) throw error;
    return (data ?? []).map((o) => o.name);
  }
  const j = await pedirAlServidor<{ borradas: string[] }>({ accion: 'borrar', bucket, rutas });
  return j.borradas;
}

export async function bajarArchivo(bucket: Bucket, ruta: string): Promise<Blob | null> {
  if ((await dondeVan()) === 'supabase') {
    const { data } = await supabase.storage.from(bucket).download(ruta);
    if (data) return data;
  }
  const url = await urlFirmada(bucket, ruta, 600);
  if (!url) return null;
  const r = await fetch(url).catch(() => null);
  return r?.ok ? r.blob() : null;
}
