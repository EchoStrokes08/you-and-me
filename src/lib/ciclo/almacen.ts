// Dónde viven las llaves y los registros. En la nube (Supabase) solo hay sobres cifrados;
// en "solo este celular" los registros quedan en IndexedDB, también cifrados, y no se suben.
import { supabase } from '../supabase';
import * as c from './cripto';
import type { Llaves, SobreCompartido, SobreLlavero } from './cripto';
import type { Ajustes, Charla, Dia } from './tipos';
import type { ContenidoAviso, VistaCompartida } from './compartir';

export type Modo = 'nube' | 'local';
type GuardadoLlaves = { llaves: Llaves; modo: Modo };

// ---------- IndexedDB mínimo ----------
const BASE = 'yam-ciclo';
function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('llaves');
      r.result.createObjectStore('datos');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function tx<T>(almacen: 'llaves' | 'datos', modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const t = db.transaction(almacen, modo);
    const req = fn(t.objectStore(almacen));
    t.oncomplete = () => { db.close(); ok(req ? req.result : undefined); };
    t.onerror = () => { db.close(); mal(t.error); };
  });
}
const idb = {
  leer: <T>(a: 'llaves' | 'datos', k: string) => tx<T>(a, 'readonly', (s) => s.get(k) as IDBRequest<T>),
  poner: (a: 'llaves' | 'datos', k: string, v: unknown) => tx(a, 'readwrite', (s) => { s.put(v, k); }),
  quitar: (a: 'llaves' | 'datos', k: string) => tx(a, 'readwrite', (s) => { s.delete(k); }),
  deUsuario: async (uid: string) => {
    const db = await abrir();
    return new Promise<{ k: string; v: { id: string; sobre: c.Sobre } }[]>((ok, mal) => {
      const salida: { k: string; v: { id: string; sobre: c.Sobre } }[] = [];
      const t = db.transaction('datos', 'readonly');
      const cursor = t.objectStore('datos').openCursor(IDBKeyRange.bound(`${uid}:`, `${uid}:￿`));
      cursor.onsuccess = () => { const cu = cursor.result; if (cu) { salida.push({ k: cu.key as string, v: cu.value }); cu.continue(); } };
      t.oncomplete = () => { db.close(); ok(salida); };
      t.onerror = () => { db.close(); mal(t.error); };
    });
  },
};

// Llaves en memoria para quien prefiere escribir su clave cada vez (no se guardan en el celular)
const enMemoria = new Map<string, GuardadoLlaves>();

export type FilaLlaves = { publica: JsonWebKey; llavero: SobreLlavero | null; llavero_recuperacion: SobreLlavero | null } | null;

export async function filaLlaves(uid: string): Promise<FilaLlaves> {
  const { data, error } = await supabase.from('ciclo_llaves').select('publica, llavero, llavero_recuperacion').eq('usuario_id', uid).maybeSingle();
  if (error) throw error;
  return data as FilaLlaves;
}

export async function llavesGuardadas(uid: string): Promise<GuardadoLlaves | null> {
  return enMemoria.get(uid) ?? (await idb.leer<GuardadoLlaves>('llaves', uid).catch(() => undefined)) ?? null;
}

async function recordar(uid: string, g: GuardadoLlaves, enEsteCelular: boolean) {
  enMemoria.set(uid, g);
  if (enEsteCelular) await idb.poner('llaves', uid, g);
  else await idb.quitar('llaves', uid);
}

export async function olvidarEnEsteCelular(uid: string) {
  enMemoria.delete(uid);
  await idb.quitar('llaves', uid);
}

export const recordadaEnEsteCelular = async (uid: string) => !!(await idb.leer('llaves', uid).catch(() => undefined));

// ---------- Crear y abrir ----------
export async function crearEnNube(uid: string, clave: string, recordarAqui: boolean) {
  const { llaves, claro } = await c.crearLlaves();
  const codigo = c.codigoRecuperacion();
  const [llavero, recuperacion] = await Promise.all([c.envolverLlavero(claro, clave), c.envolverConCodigo(claro, codigo)]);
  const { error } = await supabase.from('ciclo_llaves').upsert({ usuario_id: uid, publica: llaves.publica, llavero, llavero_recuperacion: recuperacion });
  if (error) throw error;
  await recordar(uid, { llaves, modo: 'nube' }, recordarAqui);
  return { llaves, codigo };
}

export async function crearLocal(uid: string) {
  const { llaves } = await c.crearLlaves();
  const { error } = await supabase.from('ciclo_llaves').upsert({ usuario_id: uid, publica: llaves.publica, llavero: null, llavero_recuperacion: null });
  if (error) throw error;
  await recordar(uid, { llaves, modo: 'local' }, true);
  return llaves;
}

export async function desbloquear(uid: string, fila: NonNullable<FilaLlaves>, clave: string, recordarAqui: boolean) {
  if (!fila.llavero) return null;
  const llaves = await c.abrirLlavero(fila.llavero, clave);
  if (!llaves) return null;
  await recordar(uid, { llaves, modo: 'nube' }, recordarAqui);
  return llaves;
}

// Con el código de recuperación: abre y deja una clave nueva
export async function recuperar(uid: string, fila: NonNullable<FilaLlaves>, codigo: string, nueva: string, recordarAqui: boolean) {
  if (!fila.llavero_recuperacion) return null;
  const llaves = await c.abrirConCodigo(fila.llavero_recuperacion, codigo);
  if (!llaves) return null;
  const llavero = await c.reenvolverConCodigo(fila.llavero_recuperacion, codigo, nueva);
  if (!llavero) return null;
  const { error } = await supabase.from('ciclo_llaves').update({ llavero }).eq('usuario_id', uid);
  if (error) throw error;
  await recordar(uid, { llaves, modo: 'nube' }, recordarAqui);
  return llaves;
}

export async function cambiarClave(uid: string, fila: NonNullable<FilaLlaves>, actual: string, nueva: string) {
  if (!fila.llavero) return false;
  const llavero = await c.reenvolver(fila.llavero, actual, nueva);
  if (!llavero) return false;
  const { error } = await supabase.from('ciclo_llaves').update({ llavero }).eq('usuario_id', uid);
  if (error) throw error;
  return true;
}

export async function codigoNuevo(uid: string, fila: NonNullable<FilaLlaves>, clave: string) {
  if (!fila.llavero) return null;
  const codigo = c.codigoRecuperacion();
  const recuperacion = await c.reenvolver(fila.llavero, clave, c.normalizarCodigo(codigo), 100_000);
  if (!recuperacion) return null;
  const { error } = await supabase.from('ciclo_llaves').update({ llavero_recuperacion: recuperacion }).eq('usuario_id', uid);
  if (error) throw error;
  return codigo;
}

// ---------- Registros ----------
// Las conversaciones con Payakan desde Aprender también van aquí, cifradas como un registro más
type Registro = { k: 'dia'; v: Dia } | { k: 'ajustes'; v: Ajustes } | { k: 'charla'; v: Charla };
const nombreDe = (l: Llaves, r: Registro) => c.nombreOpaco(l, r.k === 'dia' ? `dia:${r.v.fecha}` : r.k === 'charla' ? `charla:${r.v.id}` : 'ajustes');

// Cada sobre cabe en la base (menos de 40 KB): si una conversación crece, se olvidan sus turnos más viejos
const MAX_CHARLA = 24_000;
export function recortarCharla(ch: Charla): Charla {
  const turnos = [...ch.turnos];
  while (turnos.length > 2 && JSON.stringify({ ...ch, turnos }).length > MAX_CHARLA) turnos.splice(0, 2);
  return { ...ch, turnos: turnos.map((t) => ({ ...t, contenido: t.contenido.slice(0, 8000) })) };
}
const aad = (uid: string, id: string) => `${uid}/${id}`;

export class Almacen {
  readonly uid: string;
  readonly llaves: Llaves;
  readonly modo: Modo;
  constructor(uid: string, llaves: Llaves, modo: Modo) {
    this.uid = uid;
    this.llaves = llaves;
    this.modo = modo;
  }

  async cargar(): Promise<{ dias: Map<string, Dia>; ajustes: Ajustes | null; charlas: Charla[]; ilegibles: number }> {
    let filas: { id: string; sobre: c.Sobre }[];
    if (this.modo === 'nube') {
      filas = [];
      // De a 1.000 (el tope de Supabase por consulta)
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await supabase.from('ciclo_datos').select('id, sobre').eq('usuario_id', this.uid).order('id').range(desde, desde + 999);
        if (error) throw error;
        filas.push(...(data as { id: string; sobre: c.Sobre }[]));
        if (!data || data.length < 1000) break;
      }
    } else {
      filas = (await idb.deUsuario(this.uid)).map((x) => x.v);
    }
    const dias = new Map<string, Dia>();
    let ajustes: Ajustes | null = null;
    const charlas: Charla[] = [];
    let ilegibles = 0;
    await Promise.all(filas.map(async (f) => {
      try {
        const r = await c.descifrar<Registro>(this.llaves, f.sobre, aad(this.uid, f.id));
        if (r.k === 'dia') dias.set(r.v.fecha, r.v);
        else if (r.k === 'charla') charlas.push(r.v);
        else ajustes = r.v;
      } catch { ilegibles++; }
    }));
    charlas.sort((a, b) => b.actualizada.localeCompare(a.actualizada));
    return { dias, ajustes, charlas, ilegibles };
  }

  private async poner(r: Registro) {
    const id = await nombreDe(this.llaves, r);
    const sobre = await c.cifrar(this.llaves, r, aad(this.uid, id));
    if (this.modo === 'nube') {
      const { error } = await supabase.from('ciclo_datos').upsert({ usuario_id: this.uid, id, sobre });
      if (error) throw error;
    } else await idb.poner('datos', `${this.uid}:${id}`, { id, sobre });
  }

  guardarDia(d: Dia) { return this.poner({ k: 'dia', v: d }); }
  guardarAjustes(a: Ajustes) { return this.poner({ k: 'ajustes', v: a }); }
  guardarCharla(ch: Charla) { return this.poner({ k: 'charla', v: recortarCharla(ch) }); }

  async borrarCharla(id: string) {
    const nombre = await c.nombreOpaco(this.llaves, `charla:${id}`);
    if (this.modo === 'nube') {
      const { error } = await supabase.from('ciclo_datos').delete().eq('usuario_id', this.uid).eq('id', nombre);
      if (error) throw error;
    } else await idb.quitar('datos', `${this.uid}:${nombre}`);
  }

  async borrarDia(fecha: string) {
    const id = await c.nombreOpaco(this.llaves, `dia:${fecha}`);
    if (this.modo === 'nube') {
      const { error } = await supabase.from('ciclo_datos').delete().eq('usuario_id', this.uid).eq('id', id);
      if (error) throw error;
    } else await idb.quitar('datos', `${this.uid}:${id}`);
  }

  // Muchos días de una vez (al importar o al cambiar de lugar)
  async guardarVarios(dias: Dia[]) {
    const filas = await Promise.all(dias.map(async (d) => {
      const r: Registro = { k: 'dia', v: d };
      const id = await nombreDe(this.llaves, r);
      return { usuario_id: this.uid, id, sobre: await c.cifrar(this.llaves, r, aad(this.uid, id)) };
    }));
    if (this.modo === 'nube') {
      for (let i = 0; i < filas.length; i += 200) {
        const { error } = await supabase.from('ciclo_datos').upsert(filas.slice(i, i + 200));
        if (error) throw error;
      }
    } else for (const f of filas) await idb.poner('datos', `${this.uid}:${f.id}`, { id: f.id, sobre: f.sobre });
  }

  async borrarRegistros() {
    if (this.modo === 'nube') {
      const { error } = await supabase.from('ciclo_datos').delete().eq('usuario_id', this.uid);
      if (error) throw error;
    }
    for (const x of await idb.deUsuario(this.uid)) await idb.quitar('datos', x.k);
  }
}

export async function abrirAlmacen(uid: string): Promise<Almacen | null> {
  const g = await llavesGuardadas(uid);
  return g ? new Almacen(uid, g.llaves, g.modo) : null;
}

// Pasar de la nube a solo este celular (o al revés) con todo lo registrado
export async function cambiarDeLugar(a: Almacen, destino: Modo, clave?: string): Promise<{ almacen: Almacen; codigo?: string }> {
  const { dias, ajustes, charlas } = await a.cargar();
  if (destino === 'local') {
    const nuevo = new Almacen(a.uid, a.llaves, 'local');
    await nuevo.guardarVarios([...dias.values()]);
    if (ajustes) await nuevo.guardarAjustes(ajustes);
    for (const ch of charlas) await nuevo.guardarCharla(ch);
    await recordar(a.uid, { llaves: a.llaves, modo: 'local' }, true);
    const { error } = await supabase.from('ciclo_llaves').update({ llavero: null, llavero_recuperacion: null }).eq('usuario_id', a.uid);
    if (error) throw error;
    await supabase.from('ciclo_datos').delete().eq('usuario_id', a.uid);
    return { almacen: nuevo };
  }
  // A la nube: las llaves locales no se pueden exportar, así que se crean unas nuevas y se cifra todo otra vez
  if (!clave) throw new Error('Falta la clave');
  const { llaves, codigo } = await crearEnNube(a.uid, clave, true);
  const nuevo = new Almacen(a.uid, llaves, 'nube');
  await nuevo.guardarVarios([...dias.values()]);
  if (ajustes) await nuevo.guardarAjustes(ajustes);
  for (const ch of charlas) await nuevo.guardarCharla(ch);
  for (const x of await idb.deUsuario(a.uid)) await idb.quitar('datos', x.k);
  return { almacen: nuevo, codigo };
}

// ---------- Pareja ----------
export async function llavePareja(): Promise<{ usuario_id: string; publica: JsonWebKey } | null> {
  const { data, error } = await supabase.rpc('ciclo_llave_pareja');
  if (error) throw error;
  return (data as any[])?.[0] ?? null;
}

export async function idPareja(): Promise<string | null> {
  const { data } = await supabase.rpc('ciclo_id_pareja');
  return (data as string) ?? null;
}

export async function publicarVista(uid: string, pareja: { usuario_id: string; publica: JsonWebKey }, v: VistaCompartida) {
  const sobre = await c.cifrarPara(pareja.publica, v, `vista/${pareja.usuario_id}`);
  const { error } = await supabase.from('ciclo_compartido').upsert({ duena: uid, destino: pareja.usuario_id, sobre });
  if (error) throw error;
}

// Revocar: se borra lo compartido y los avisos (también los programados). No se le notifica nada
export async function revocar(uid: string) {
  const [a, b] = await Promise.all([
    supabase.from('ciclo_compartido').delete().eq('duena', uid),
    supabase.from('ciclo_avisos').delete().eq('de', uid),
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
}

export async function reprogramarAvisos(uid: string, pareja: { usuario_id: string; publica: JsonWebKey }, avisos: { enviarEn: string; contenido: ContenidoAviso }[]) {
  // Solo los programados que todavía no salen; los del momento ya enviados se quedan
  const { error } = await supabase.from('ciclo_avisos').delete().eq('de', uid).is('enviado_en', null).gt('enviar_en', new Date(Date.now() + 120000).toISOString());
  if (error) throw error;
  if (!avisos.length) return;
  const filas = await Promise.all(avisos.map(async (a) => ({
    para: pareja.usuario_id, enviar_en: a.enviarEn, sobre: await c.cifrarPara(pareja.publica, a.contenido, `aviso/${pareja.usuario_id}`),
  })));
  const r = await supabase.from('ciclo_avisos').insert(filas);
  if (r.error) throw r.error;
}

export async function mandarAviso(pareja: { usuario_id: string; publica: JsonWebKey }, contenido: ContenidoAviso) {
  const sobre = await c.cifrarPara(pareja.publica, contenido, `aviso/${pareja.usuario_id}`);
  const { error } = await supabase.from('ciclo_avisos').insert({ para: pareja.usuario_id, sobre });
  if (error) throw error;
}

export async function leerVistaRecibida(uid: string, llaves: Llaves): Promise<{ vista: VistaCompartida; actualizado: string } | null> {
  const { data, error } = await supabase.from('ciclo_compartido').select('sobre, updated_at').eq('destino', uid).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const vista = await c.abrirDePareja<VistaCompartida>(llaves, data.sobre as SobreCompartido, `vista/${uid}`);
  return vista ? { vista, actualizado: data.updated_at } : null;
}

export type AvisoRecibido = { id: string; enviarEn: string; contenido: ContenidoAviso };
export async function leerAvisosRecibidos(uid: string, llaves: Llaves): Promise<AvisoRecibido[]> {
  const { data, error } = await supabase.from('ciclo_avisos').select('id, enviar_en, sobre').eq('para', uid).order('enviar_en', { ascending: false }).limit(30);
  if (error) throw error;
  const salida: AvisoRecibido[] = [];
  for (const f of data ?? []) {
    const contenido = await c.abrirDePareja<ContenidoAviso>(llaves, f.sobre as SobreCompartido, `aviso/${uid}`);
    if (contenido) salida.push({ id: f.id, enviarEn: f.enviar_en, contenido });
  }
  return salida;
}

export async function descartarAviso(id: string) {
  await supabase.from('ciclo_avisos').delete().eq('id', id);
}

export async function registrarConsentimiento(accion: 'otorgado' | 'revocado', version: string) {
  await supabase.from('ciclo_consentimientos').insert({ accion, version });
}

// Borrar todo: registros, llaves, lo compartido, avisos, y lo guardado en este celular
export async function borrarTodo(uid: string, a: Almacen | null) {
  await revocar(uid);
  if (a) await a.borrarRegistros();
  const r = await supabase.from('ciclo_datos').delete().eq('usuario_id', uid);
  if (r.error) throw r.error;
  const l = await supabase.from('ciclo_llaves').delete().eq('usuario_id', uid);
  if (l.error) throw l.error;
  // Lo recibido de la pareja tampoco se queda
  await supabase.from('ciclo_avisos').delete().eq('para', uid).lte('enviar_en', new Date().toISOString());
  await olvidarEnEsteCelular(uid);
}
