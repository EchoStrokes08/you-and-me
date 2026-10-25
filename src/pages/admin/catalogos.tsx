// Editor de todos los catálogos de la app (categorías, lugares, actividades, franjas y qué llevar),
// una sola pantalla del Admin: crear/editar/desactivar, con imagen, mapa y cuántas citas usa
// cada elemento. Ojo: aquí se edita el vocabulario que el asistente usa para planear y, con
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Actividad, CategoriaCita, Franja, Lugar } from '../../lib/tipos';
import { claveLugar, type PorConocer } from '../../lib/porConocer';
import { AnimatePresence } from 'framer-motion';
import { IconoAtras, IconoCamara, IconoLapiz, IconoPin } from '../../components/ui';
import MapaLugar from '../../components/citas/MapaLugar';
import { useAvisos } from '../../lib/avisos';
import { EN_USO } from './comun';

type TablaCatalogo = 'categorias_cita' | 'lugares' | 'actividades' | 'franjas' | 'opciones_llevar';

/** Un elemento de cualquier catálogo: lo que todos tienen va con tipo; lo propio de cada uno se lee por el nombre del campo (ver CAMPOS) */
type ItemCatalogo = Pick<Lugar, 'nombre' | 'emoji' | 'activo' | 'orden'> & {
  id?: string; slug?: string; lat?: number | null; lng?: number | null; zona?: string; [campo: string]: unknown;
};
type Valor = string | number | boolean | string[] | null;

// El editor es uno solo para las cinco tablas. El cliente tipado no sabe escribir "en cualquiera de ellas",
// así que aquí, y solo aquí, se le habla sin tipos
const sinTipos = supabase as unknown as SupabaseClient;

type Campo = [clave: string, etiqueta: string, tipo?: 'textarea' | 'precio' | 'tipo-llevar' | 'tipos-plan' | 'momentos' | 'si-no'];
// Qué se puede editar de cada catálogo (el slug de las categorías no: lo usan las citas)
const CAMPOS: Record<TablaCatalogo, Campo[]> = {
  categorias_cita: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['descripcion', 'Descripción', 'textarea']],
  lugares: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['zona', 'Zona'], ['descripcion', 'Descripción', 'textarea'], ['duracion', 'Duración'], ['precio', 'Precio', 'precio'], ['categorias', 'Tipos de plan', 'tipos-plan']],
  // Con esto el asistente arma citas con sentido: una idea solo sale en los lugares donde está anotada
  // o, si es general, en los de su mismo tipo de plan; y a una hora en que se pueda hacer
  actividades: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['descripcion', 'Descripción', 'textarea'], ['nota', 'Nota'], ['precio', 'Precio', 'precio'],
    ['categorias', 'Tipos de plan', 'tipos-plan'], ['es_comodin', 'Sirve en cualquier lugar de esos tipos de plan', 'si-no'], ['franjas_permitidas', 'Momentos del día (ninguno = cualquiera)', 'momentos']],
  franjas: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['horario', 'Horario']],
  opciones_llevar: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['descripcion', 'Descripción', 'textarea'], ['tipo', 'Tipo', 'tipo-llevar']],
};

// Con qué columna de la cita se cuenta el uso de cada catálogo (qué llevar va aparte: vestimenta y detalles)
const CAMPO_EN_CITA: Partial<Record<TablaCatalogo, 'lugar_id' | 'actividad_id' | 'franja_id' | 'categoria_slug'>> = { lugares: 'lugar_id', actividades: 'actividad_id', franjas: 'franja_id', categorias_cita: 'categoria_slug' };

// Las categorías usan slug como llave; el resto, id
const llave = (it: ItemCatalogo): [string, string] => (it.id ? ['id', it.id] : ['slug', it.slug ?? '']);

async function subirFotoCatalogo(file: File): Promise<string | null> {
  const ruta = `${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('catalogo').upload(ruta, file, { upsert: true });
  if (error) return null;
  return supabase.storage.from('catalogo').getPublicUrl(ruta).data.publicUrl;
}

export function Catalogos() {
  const { revisar, aviso } = useAvisos();
  const [tabla, setTabla] = useState<TablaCatalogo>('lugares');
  const [items, setItems] = useState<ItemCatalogo[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [tipos, setTipos] = useState<Pick<CategoriaCita, 'slug' | 'nombre' | 'emoji'>[]>([]);
  const [momentos, setMomentos] = useState<Pick<Franja, 'id' | 'nombre' | 'emoji'>[]>([]);
  const [ubicando, setUbicando] = useState<ItemCatalogo | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  // En cuántas citas (sin contar las canceladas) se ha usado cada cosa del catálogo
  const [usos, setUsos] = useState<Record<string, number>>({});
  const [soloSinUsar, setSoloSinUsar] = useState(false);
  const [porConocer, setPorConocer] = useState<PorConocer[]>([]);
  const cargar = useCallback(async () => {
    setItems((await sinTipos.from(tabla).select('*').order('orden')).data ?? []);
    const { data: citas } = await supabase.from('citas').select('lugar_id, actividad_id, franja_id, categoria_slug, vestimenta_id, cita_detalles(opcion_id)').neq('estado', 'cancelada');
    const cuenta: Record<string, number> = {};
    const campoEnCita = CAMPO_EN_CITA[tabla];
    for (const c of citas ?? []) {
      const claves = tabla === 'opciones_llevar' ? [c.vestimenta_id, ...c.cita_detalles.map((d) => d.opcion_id)] : campoEnCita ? [c[campoEnCita]] : [];
      for (const k of claves) if (k) cuenta[k] = (cuenta[k] ?? 0) + 1;
    }
    setUsos(cuenta);
    setPorConocer(tabla === 'lugares' ? ((await supabase.from('lugares_por_conocer').select('*').order('created_at', { ascending: false })).data ?? []) : []);
    setActividades((await supabase.from('actividades').select('*').order('orden')).data ?? []);
    setTipos((await supabase.from('categorias_cita').select('slug, nombre, emoji').eq('activo', true).order('orden')).data ?? []);
    setMomentos((await supabase.from('franjas').select('id, nombre, emoji').eq('activo', true).order('orden')).data ?? []);
  }, [tabla]);
  useEffect(() => { cargar(); setEditando(null); setSoloSinUsar(false); }, [cargar]);

  const sinUsar = items.filter((it) => !usos[it.id ?? it.slug ?? '']);
  // Lugares por conocer que todavía no están en el catálogo (ni por nombre ni por punto en el mapa)
  const enCatalogo = new Set(items.flatMap((it) => [String(it.nombre ?? '').trim().toLowerCase(), it.lat != null && it.lng != null ? claveLugar(it.lat, it.lng) : '']));
  const fuera = porConocer.filter((d) => !enCatalogo.has(d.nombre.trim().toLowerCase()) && !enCatalogo.has(claveLugar(d.lat, d.lng)));
  const pasarAlCatalogo = async (d: PorConocer) => {
    const { error } = revisar(await supabase.from('lugares').insert({
      nombre: d.nombre, emoji: '📍', descripcion: d.nota, lat: d.lat, lng: d.lng,
      categorias: d.categoria_slug ? [d.categoria_slug] : [], precio: 2, duracion: 'Medio día',
    }), 'No pude pasarlo al catálogo');
    if (!error) aviso('Ya está en el catálogo 💚 Revísale el precio y las actividades');
    cargar();
  };

  const actualizar = async (it: ItemCatalogo, cambios: Record<string, Valor>, error: string) => {
    const [k, v] = llave(it);
    revisar(await sinTipos.from(tabla).update(cambios).eq(k, v), error);
    cargar();
  };
  const toggleActivo = (it: ItemCatalogo) => actualizar(it, { activo: !it.activo }, 'No pude cambiarlo');
  const mover = (it: ItemCatalogo, dir: number) => actualizar(it, { orden: (it.orden ?? 0) + dir }, 'No pude moverlo');
  const foto = async (it: ItemCatalogo, file: File) => {
    const url = await subirFotoCatalogo(file);
    if (!url) { aviso('No pude subir la foto 😢', 'error'); return; }
    actualizar(it, { imagen_url: url }, 'No pude guardar la foto');
  };
  const ubicar = async (it: ItemCatalogo, lat: number, lng: number) => {
    setUbicando(null);
    actualizar(it, { lat, lng }, 'No pude guardar la ubicación');
  };

  return (
    <div className="flex flex-col gap-3">
      <select value={tabla} onChange={(e) => setTabla(e.target.value as TablaCatalogo)} className="input">
        <option value="categorias_cita">Tipos de plan</option>
        <option value="lugares">Lugares</option>
        <option value="actividades">Actividades</option>
        <option value="franjas">Franjas</option>
        <option value="opciones_llevar">Qué llevar</option>
      </select>
      <NuevoItem tabla={tabla} actividades={actividades} onDone={cargar} />
      {fuera.length > 0 && (
        <div className="card p-3 rounded-2xl flex flex-col gap-2">
          <p className="eyebrow">Por conocer, fuera del catálogo</p>
          {fuera.map((d) => (
            <div key={d.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-tight truncate">{d.nombre}</p>
                <p className="text-sm text-salvia truncate">{d.nota || d.direccion || 'Marcado en el mapa'}</p>
              </div>
              <button onClick={() => pasarAlCatalogo(d)} className="chip px-3 text-sm shrink-0">Pasar al catálogo</button>
            </div>
          ))}
        </div>
      )}
      {sinUsar.length > 0 && (
        <button onClick={() => setSoloSinUsar(!soloSinUsar)} data-active={soloSinUsar} aria-pressed={soloSinUsar} className="chip px-3 text-sm self-start">
          Solo lo que nunca se ha usado ({sinUsar.length})
        </button>
      )}
      {(soloSinUsar ? sinUsar : items).map((it) => {
        const id = it.id ?? it.slug ?? '';
        return (
          <div key={id} className="card p-3 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">{it.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold leading-tight">{it.nombre}</p>
                <p className="text-sm text-salvia">{it.activo ? 'Visible' : 'Oculto'} · puesto {it.orden}{tabla === 'lugares' && it.lat == null ? ' · sin ubicación' : ''} · {usos[id] ? `${usos[id]} ${usos[id] === 1 ? 'cita' : 'citas'}` : 'sin usar'}</p>
              </div>
              <button onClick={() => toggleActivo(it)} className="chip px-3 text-sm text-coral shrink-0">{it.activo ? 'Ocultar' : 'Mostrar'}</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditando(editando === id ? null : id)} aria-label={`Editar ${it.nombre}`} aria-expanded={editando === id} className={`btn-icon ${editando === id ? 'bg-seleccion border-bosque' : ''}`}><IconoLapiz className="w-5 h-5" /></button>
              <input type="file" accept="image/*" className="hidden" id={`f-${id}`} onChange={(e) => e.target.files?.[0] && foto(it, e.target.files[0])} />
              {tabla === 'lugares' && (
                <button onClick={() => setUbicando(it)} aria-label={`Ubicación de ${it.nombre} en el mapa`} className={`btn-icon ${it.lat != null ? 'bg-seleccion border-bosque' : ''}`}><IconoPin className="w-5 h-5" /></button>
              )}
              <label htmlFor={`f-${id}`} aria-label={`Cambiar la foto de ${it.nombre}`} className="btn-icon cursor-pointer"><IconoCamara className="w-5 h-5" /></label>
              <button onClick={() => mover(it, -1)} aria-label={`Subir ${it.nombre}`} className="btn-icon ml-auto"><IconoAtras className="w-5 h-5 rotate-90" /></button>
              <button onClick={() => mover(it, 1)} aria-label={`Bajar ${it.nombre}`} className="btn-icon"><IconoAtras className="w-5 h-5 -rotate-90" /></button>
            </div>
            {editando === id && (
              <EditarItem tabla={tabla} item={it} actividades={actividades} tipos={tipos} momentos={momentos} onDone={() => { setEditando(null); cargar(); }} />
            )}
          </div>
        );
      })}
      <AnimatePresence>
        {ubicando && (
          <MapaLugar
            inicial={ubicando.lat != null && ubicando.lng != null ? { nombre: ubicando.nombre, direccion: ubicando.zona ?? '', lat: ubicando.lat, lng: ubicando.lng } : null}
            onClose={() => setUbicando(null)}
            onPick={(l) => ubicar(ubicando, l.lat, l.lng)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ChipsActividades({ actividades, sel, setSel }: { actividades: Actividad[]; sel: string[]; setSel: (v: string[]) => void }) {
  return (
    <>
      <p className="text-sm font-bold">Actividades:</p>
      <div className="flex flex-wrap gap-1">
        {actividades.map((a) => (
          <button key={a.id} onClick={() => setSel(sel.includes(a.id) ? sel.filter((x) => x !== a.id) : [...sel, a.id])}
            className="chip px-3 text-sm" data-active={sel.includes(a.id)} aria-pressed={sel.includes(a.id)}>{a.nombre}</button>
        ))}
      </div>
    </>
  );
}

function EditarItem({ tabla, item, actividades, tipos, momentos, onDone }: { tabla: TablaCatalogo; item: ItemCatalogo; actividades: Actividad[]; tipos: Pick<CategoriaCita, 'slug' | 'nombre' | 'emoji'>[]; momentos: Pick<Franja, 'id' | 'nombre' | 'emoji'>[]; onDone: () => void }) {
  const { revisar, confirmar, aviso } = useAvisos();
  const campos = CAMPOS[tabla];
  const [datos, setDatos] = useState<Record<string, Valor>>(() => Object.fromEntries(campos.map(([k]) => [k, (item[k] as Valor) ?? ''])));
  const [selActs, setSelActs] = useState<string[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (tabla !== 'lugares' || !item.id) return;
    supabase.from('lugar_actividad').select('actividad_id').eq('lugar_id', item.id)
      .then(({ data }) => setSelActs((data ?? []).map((d) => d.actividad_id)));
  }, [tabla, item.id]);

  const guardar = async () => {
    if (!String(datos.nombre ?? '').trim()) { aviso('El nombre no puede quedar vacío', 'error'); return; }
    setGuardando(true);
    const [k, v] = llave(item);
    const franjas = datos.franjas_permitidas;
    const cambios = {
      ...datos, nombre: String(datos.nombre).trim(), ...('nota' in datos ? { nota: datos.nota || null } : {}),
      ...('categorias' in datos ? { categorias: datos.categorias || [] } : {}),
      ...('es_comodin' in datos ? { es_comodin: !!datos.es_comodin } : {}),
      ...('franjas_permitidas' in datos ? { franjas_permitidas: Array.isArray(franjas) && franjas.length ? franjas : null } : {}),
    };
    const { error } = revisar(await sinTipos.from(tabla).update(cambios).eq(k, v), 'No pude guardar los cambios');
    const lugarId = item.id;
    if (!error && tabla === 'lugares' && selActs && lugarId) {
      const borrado = revisar(await supabase.from('lugar_actividad').delete().eq('lugar_id', lugarId), 'No pude actualizar las actividades');
      if (!borrado.error && selActs.length) {
        revisar(await supabase.from('lugar_actividad').insert(selActs.map((a) => ({ lugar_id: lugarId, actividad_id: a }))), 'No pude actualizar las actividades');
      }
    }
    setGuardando(false);
    if (!error) { aviso('Guardado 💚'); onDone(); }
  };

  const borrar = async () => {
    if (!(await confirmar({ titulo: `¿Borrar «${item.nombre}»?`, texto: 'No se puede deshacer. Si solo no quieres que aparezca, mejor ocúltalo.', boton: 'Borrar', peligro: true }))) return;
    const [k, v] = llave(item);
    const { error } = await sinTipos.from(tabla).delete().eq(k, v);
    if (error?.code === EN_USO) { aviso(`«${item.nombre}» ya se usa en alguna cita; mejor ocúltalo`, 'error'); return; }
    revisar({ error }, 'No pude borrarlo');
    if (!error) { aviso('Borrado'); onDone(); }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-menta pt-3">
      {campos.map(([k, etiqueta, tipo]) => tipo === 'tipos-plan' || tipo === 'momentos' ? (
        <div key={k}>
          <p className="text-sm font-bold text-bosque-oscuro">{etiqueta}</p>
          <div className="flex flex-wrap gap-1 mt-1" role="group" aria-label={etiqueta}>
            {(tipo === 'tipos-plan' ? tipos.map((c) => [c.slug, c] as const) : momentos.map((f) => [f.id, f] as const)).map(([v, o]) => {
              const valor = datos[k];
              const sel = Array.isArray(valor) ? valor : [];
              return <button key={v} type="button" onClick={() => setDatos({ ...datos, [k]: sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v] })}
                className="chip px-3 text-sm" data-active={sel.includes(v)} aria-pressed={sel.includes(v)}>{o.emoji} {o.nombre}</button>;
            })}
          </div>
        </div>
      ) : tipo === 'si-no' ? (
        <label key={k} className="text-sm font-bold text-bosque-oscuro flex items-center gap-2">
          <input type="checkbox" checked={!!datos[k]} onChange={(e) => setDatos({ ...datos, [k]: e.target.checked })} className="w-5 h-5 accent-bosque" />
          {etiqueta}
        </label>
      ) : (
        <label key={k} className="text-sm font-bold text-bosque-oscuro">{etiqueta}
          {tipo === 'textarea' ? (
            <textarea value={String(datos[k] ?? '')} onChange={(e) => setDatos({ ...datos, [k]: e.target.value })} className="input mt-1 min-h-16 text-sm font-normal text-bosque-oscuro" />
          ) : tipo === 'precio' ? (
            <select value={Number(datos[k])} onChange={(e) => setDatos({ ...datos, [k]: Number(e.target.value) })} className="input mt-1 text-sm">
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{'$'.repeat(n)}</option>)}
            </select>
          ) : tipo === 'tipo-llevar' ? (
            <select value={String(datos[k] ?? '')} onChange={(e) => setDatos({ ...datos, [k]: e.target.value })} className="input mt-1 text-sm">
              <option value="detalle">Detalle</option>
              <option value="vestimenta">Vestimenta</option>
            </select>
          ) : (
            <input value={String(datos[k] ?? '')} onChange={(e) => setDatos({ ...datos, [k]: e.target.value })} className="input mt-1 text-sm font-normal text-bosque-oscuro" />
          )}
        </label>
      ))}
      {tabla === 'lugares' && selActs && <ChipsActividades actividades={actividades} sel={selActs} setSel={setSelActs} />}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <button onClick={borrar} className="btn-soft py-2.5 bg-durazno/30 border-durazno/60 text-coral">Borrar</button>
        <button onClick={guardar} disabled={guardando} className="btn-primary py-2.5">{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  );
}

function NuevoItem({ tabla, actividades, onDone }: { tabla: TablaCatalogo; actividades: Actividad[]; onDone: () => void }) {
  const { revisar, aviso } = useAvisos();
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [slug, setSlug] = useState('');
  const [categoria, setCategoria] = useState('');
  const [selActs, setSelActs] = useState<string[]>([]);
  const [abierto, setAbierto] = useState(false);

  const guardar = async () => {
    if (!nombre) return;
    const msg = 'No pude agregarlo';
    let error: { message: string } | null = null;
    if (tabla === 'categorias_cita') {
      ({ error } = revisar(await supabase.from('categorias_cita').insert({ slug: slug || nombre.toLowerCase().replaceAll(' ', '-'), nombre, emoji, color: '#8FB39A' }), msg));
    } else if (tabla === 'lugares') {
      const res = revisar(await supabase.from('lugares').insert({ nombre, emoji, categorias: categoria ? [categoria] : [], precio: 2, duracion: 'Medio día' }).select().single(), msg);
      error = res.error;
      if (res.data && selActs.length) {
        revisar(await supabase.from('lugar_actividad').insert(selActs.map((a) => ({ lugar_id: res.data.id, actividad_id: a }))), 'Lo agregué, pero no pude guardar sus actividades');
      }
    } else if (tabla === 'actividades') {
      ({ error } = revisar(await supabase.from('actividades').insert({ nombre, emoji, precio: 2 }), msg));
    } else if (tabla === 'franjas') {
      ({ error } = revisar(await supabase.from('franjas').insert({ nombre, emoji, horario: '' }), msg));
    } else {
      ({ error } = revisar(await supabase.from('opciones_llevar').insert({ tipo: 'detalle', nombre, emoji }), msg));
    }
    if (error) return;
    aviso('Agregado 💚');
    setNombre(''); setSlug(''); setEmoji('✨'); setSelActs([]); setAbierto(false); onDone();
  };

  return abierto ? (
    <div className="card p-3 rounded-2xl flex flex-col gap-2">
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="input" />
      <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="Emoji" className="input" />
      {tabla === 'categorias_cita' && <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (opcional)" className="input" />}
      {tabla === 'lugares' && (
        <>
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Slug de categoría (ej: romantico)" className="input" />
          <ChipsActividades actividades={actividades} sel={selActs} setSel={setSelActs} />
        </>
      )}
      <button onClick={guardar} className="btn-primary py-2.5">Guardar</button>
    </div>
  ) : (
    <button onClick={() => setAbierto(true)} className="btn-soft py-2.5 border-dashed">+ Agregar</button>
  );
}
