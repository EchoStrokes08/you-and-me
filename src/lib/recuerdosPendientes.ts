// Recuerdos que quedaron sin subir por falta de señal: se guardan en IndexedDB (con sus fotos y
// videos) y se suben solos cuando vuelve la conexión. App.tsx lanza la subida al abrir la app y
// Historia avisa a la lista con un evento. Ojo: guarda archivos en el teléfono hasta lograrlo.
import { supabase } from './supabase';
import { subirFotos } from './fotos';
import { sinConexion } from './avisos';

/* Recuerdos por subir: si al guardar un recuerdo nuevo no hay señal, queda en el teléfono
   (IndexedDB, con sus fotos y videos) y se sube solo cuando vuelve la conexión. */

export type RecuerdoPendiente = {
  // El mismo id que tendrá el recuerdo: si la subida se corta a medias, al reintentar no se duplica
  id: string;
  guardado: number;
  campos: { titulo: string; fecha: string; lugar_texto: string; descripcion: string; calificacion: number; lat: number | null; lng: number | null };
  citaId: string | null;
  suenoId: string | null;
  archivos: File[];
  // Cuántos archivos ya se subieron (para seguir con el orden correcto)
  subidos: number;
};

// Se avisa a quien esté mostrando la lista (Historia) cada vez que cambia
export const CAMBIO = 'recuerdos-pendientes';
const avisar = (subido?: string) => window.dispatchEvent(new CustomEvent(CAMBIO, { detail: { subido } }));

const BD = 'recuerdos-pendientes';
const abrirBD = () => new Promise<IDBDatabase>((ok, falla) => {
  const r = indexedDB.open(BD, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('recuerdos', { keyPath: 'id' });
  r.onsuccess = () => ok(r.result);
  r.onerror = () => falla(r.error);
});

async function tx<T>(modo: IDBTransactionMode, hacer: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const bd = await abrirBD();
  try {
    return await new Promise<T | undefined>((ok, falla) => {
      const t = bd.transaction('recuerdos', modo);
      const r = hacer(t.objectStore('recuerdos'));
      t.oncomplete = () => ok(r ? r.result : undefined);
      t.onerror = () => falla(t.error);
      t.onabort = () => falla(t.error);
    });
  } finally {
    bd.close();
  }
}

export async function leerPendientes(): Promise<RecuerdoPendiente[]> {
  try {
    return ((await tx<RecuerdoPendiente[]>('readonly', (s) => s.getAll())) ?? []).sort((a, b) => a.guardado - b.guardado);
  } catch {
    return [];
  }
}

// Devuelve false si el teléfono no dejó guardarlo (sin espacio, navegación privada…)
export async function guardarPendiente(p: Omit<RecuerdoPendiente, 'id' | 'guardado' | 'subidos'>): Promise<boolean> {
  try {
    await tx('readwrite', (s) => { s.put({ ...p, id: crypto.randomUUID(), guardado: Date.now(), subidos: 0 }); });
    avisar();
    return true;
  } catch {
    return false;
  }
}

export async function descartarPendiente(id: string) {
  try { await tx('readwrite', (s) => { s.delete(id); }); } catch { /* ya no estaba */ }
  avisar();
}

// Falla de red (no un rechazo de la base): vale la pena guardar en el teléfono y reintentar
export const esFallaDeRed = (error: { message?: string; code?: string } | null) =>
  !!error && (sinConexion() || (!error.code && /fetch|network|load failed/i.test(error.message ?? '')));

async function subir(p: RecuerdoPendiente, usuario: string): Promise<boolean> {
  const { error } = await supabase.from('recuerdos').insert({ ...p.campos, id: p.id, cita_id: p.citaId, creado_por: usuario });
  // 23505: ya se había creado en un intento anterior que se cortó después
  if (error && error.code !== '23505') {
    // La base lo rechazó (no es la red): no tiene sentido reintentar solo; queda en la lista para subirlo a mano o descartarlo
    return false;
  }
  if (p.citaId) await supabase.from('citas').update({ estado: 'vivida' }).eq('id', p.citaId);
  if (p.suenoId) await supabase.from('suenos').update({ recuerdo_id: p.id }).eq('id', p.suenoId);

  // De a un archivo, anotando el avance: si se corta, el siguiente intento sigue donde iba
  while (p.archivos.length) {
    if (await subirFotos(p.id, [p.archivos[0]], p.subidos)) return false;
    p = { ...p, archivos: p.archivos.slice(1), subidos: p.subidos + 1 };
    await tx('readwrite', (s) => { s.put(p); });
  }
  await tx('readwrite', (s) => { s.delete(p.id); });
  return true;
}

// Sube todo lo pendiente. Devuelve los títulos de los que quedaron arriba.
// Solo corre una vez a la vez, aunque lo llamen el inicio, "online" y la vuelta a la app.
let enCurso: Promise<string[]> | null = null;
export function subirPendientes(usuario: string): Promise<string[]> {
  // Si ya hay una subida andando, quien la empezó es el que avisa
  if (enCurso) return enCurso.then(() => []);
  enCurso = (async () => {
    const subidos: string[] = [];
    if (sinConexion()) return subidos;
    for (const p of await leerPendientes()) {
      if (sinConexion()) break;
      let ok = false;
      try { ok = await subir(p, usuario); } catch { /* red caída a medias: se reintenta después */ }
      if (ok) { subidos.push(p.campos.titulo); avisar(p.id); } else avisar();
    }
    return subidos;
  })().finally(() => { enCurso = null; });
  return enCurso;
}
