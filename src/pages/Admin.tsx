import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fechaBonita, fechaStr, hoy, nombreLugar, linkMapa } from '../lib/utils';
import { AnimatePresence } from 'framer-motion';
import { Encabezado, Segmented, Vacio } from '../components/ui';
import MapaLugar from '../components/MapaLugar';
import EditarCita from '../components/EditarCita';
import { useAvisos } from '../lib/avisos';

// Postgres: no se puede borrar porque otra fila la usa (foreign key)
const EN_USO = '23503';

export default function Admin() {
  const [tab, setTab] = useState<'solicitudes' | 'catalogos' | 'preguntas' | 'fechas' | 'config'>('solicitudes');
  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Encabezado eyebrow="Detrás del telón" titulo="Panel ⚙️" />
      <Segmented id="tabs-admin" value={tab} onChange={setTab} options={[['solicitudes', 'Solicitudes'], ['catalogos', 'Catálogos'], ['preguntas', 'Preguntas'], ['fechas', 'Fechas'], ['config', 'Config']] as const} />
      {tab === 'solicitudes' && <Solicitudes />}
      {tab === 'catalogos' && <Catalogos />}
      {tab === 'preguntas' && <AdminPreguntas />}
      {tab === 'fechas' && <Fechas />}
      {tab === 'config' && <Config />}
    </div>
  );
}

function Solicitudes() {
  const { pedirTexto, revisar, aviso } = useAvisos();
  const [citas, setCitas] = useState<any[]>([]);
  const [filtro, setFiltro] = useState('pendiente');
  const [editando, setEditando] = useState<any>(null);
  const cargar = useCallback(async () => {
    const { data } = await supabase.from('citas').select('*, lugares(nombre), actividades(nombre), franjas(nombre), categorias_cita(nombre)').eq('estado', filtro).order('fecha');
    setCitas(data ?? []);
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  const confirmar = async (c: any, hora: string, nota: string) => {
    const { error } = revisar(await supabase.from('citas').update({ estado: 'confirmada', hora_confirmada: hora || null, nota_admin: nota || null, modificada: false }).eq('id', c.id), 'No pude confirmar la cita');
    if (!error) aviso('Cita confirmada ✅');
    cargar();
  };
  const cancelar = async (c: any) => {
    // null = tocó "Volver": la cita queda como estaba
    const msg = await pedirTexto({ titulo: '¿Cancelar esta cita?', texto: 'Ella verá el mensaje en la cita.', placeholder: 'Mensaje para ella (opcional)', boton: 'Cancelar cita', peligro: true });
    if (msg === null) return;
    const { error } = revisar(await supabase.from('citas').update({ estado: 'cancelada', nota_admin: msg.trim() || null }).eq('id', c.id), 'No pude cancelar la cita');
    if (!error) aviso('Cita cancelada');
    cargar();
  };

  return (
    <div className="flex flex-col gap-3">
      <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="input">
        <option value="pendiente">Pendientes</option>
        <option value="confirmada">Confirmadas</option>
        <option value="vivida">Vividas</option>
        <option value="cancelada">Canceladas</option>
      </select>
      {citas.map((c) => <SolicitudCard key={c.id} c={c} onConfirmar={confirmar} onCancelar={cancelar} onEditar={() => setEditando(c)} />)}
      <AnimatePresence>
        {editando && <EditarCita cita={editando} onClose={() => setEditando(null)} onSaved={cargar} />}
      </AnimatePresence>
      {citas.length === 0 && <Vacio titulo="Nada por aquí" texto="Mar en calma 🌊" />}
    </div>
  );
}

function SolicitudCard({ c, onConfirmar, onCancelar, onEditar }: any) {
  const [hora, setHora] = useState(c.hora_confirmada ?? '');
  const [nota, setNota] = useState(c.nota_admin ?? '');
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold">{c.es_cita_sorpresa ? '🎁 Sorpresa' : `${c.categorias_cita?.nombre} · ${nombreLugar(c) ?? ''}`}</p>
        {['pendiente', 'confirmada'].includes(c.estado) && <button onClick={onEditar} className="chip py-1 px-3 text-xs shrink-0">✏️ Editar</button>}
      </div>
      {c.modificada && c.estado === 'pendiente' && <span className="badge bg-durazno/35 text-coral self-start">✏️ Ella la modificó: revisa y confirma</span>}
      <p className="text-sm">{c.actividades?.nombre} · {c.franjas?.nombre} · {fechaBonita(c.fecha)}</p>
      {linkMapa(c) && (
        <a href={linkMapa(c)!} target="_blank" rel="noreferrer" className="text-sm text-bosque font-bold">📍 {c.lugar_direccion || 'Ver en el mapa'} →</a>
      )}
      {c.nota_ella && <p className="text-sm italic">"{c.nota_ella}"</p>}
      {c.estado === 'pendiente' && (
        <>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="input" />
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" className="input" />
          <div className="flex gap-2">
            <button onClick={() => onConfirmar(c, hora, nota)} className="flex-1 btn-primary py-2.5">Confirmar ✅</button>
            <button onClick={() => onCancelar(c)} className="flex-1 btn-soft py-2.5 bg-durazno/30 border-durazno/60 text-coral">Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Catálogos ---------- */

type Campo = [clave: string, etiqueta: string, tipo?: 'textarea' | 'precio' | 'tipo-llevar'];
// Qué se puede editar de cada catálogo (el slug de las categorías no: lo usan las citas)
const CAMPOS: Record<string, Campo[]> = {
  categorias_cita: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['descripcion', 'Descripción', 'textarea']],
  lugares: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['zona', 'Zona'], ['descripcion', 'Descripción', 'textarea'], ['duracion', 'Duración'], ['precio', 'Precio', 'precio']],
  actividades: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['descripcion', 'Descripción', 'textarea'], ['nota', 'Nota'], ['precio', 'Precio', 'precio']],
  franjas: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['horario', 'Horario']],
  opciones_llevar: [['nombre', 'Nombre'], ['emoji', 'Emoji'], ['descripcion', 'Descripción', 'textarea'], ['tipo', 'Tipo', 'tipo-llevar']],
};

// Las categorías usan slug como llave; el resto, id
const llave = (it: any): [string, string] => ('id' in it ? ['id', it.id] : ['slug', it.slug]);

async function subirFotoCatalogo(file: File): Promise<string | null> {
  const ruta = `${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('catalogo').upload(ruta, file, { upsert: true });
  if (error) return null;
  return supabase.storage.from('catalogo').getPublicUrl(ruta).data.publicUrl;
}

function Catalogos() {
  const { revisar, aviso } = useAvisos();
  const [tabla, setTabla] = useState<string>('lugares');
  const [items, setItems] = useState<any[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);
  const [ubicando, setUbicando] = useState<any>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    setItems((await supabase.from(tabla as any).select('*').order('orden')).data ?? []);
    setActividades((await supabase.from('actividades').select('*').order('orden')).data ?? []);
  }, [tabla]);
  useEffect(() => { cargar(); setEditando(null); }, [cargar]);

  const actualizar = async (it: any, cambios: any, error: string) => {
    const [k, v] = llave(it);
    revisar(await supabase.from(tabla as any).update(cambios).eq(k, v), error);
    cargar();
  };
  const toggleActivo = (it: any) => actualizar(it, { activo: !it.activo }, 'No pude cambiarlo');
  const mover = (it: any, dir: number) => actualizar(it, { orden: (it.orden ?? 0) + dir }, 'No pude moverlo');
  const foto = async (it: any, file: File) => {
    const url = await subirFotoCatalogo(file);
    if (!url) { aviso('No pude subir la foto 😢', 'error'); return; }
    actualizar(it, { imagen_url: url }, 'No pude guardar la foto');
  };
  const ubicar = async (it: any, lat: number, lng: number) => {
    setUbicando(null);
    actualizar(it, { lat, lng }, 'No pude guardar la ubicación');
  };

  return (
    <div className="flex flex-col gap-3">
      <select value={tabla} onChange={(e) => setTabla(e.target.value)} className="input">
        <option value="categorias_cita">Tipos de plan</option>
        <option value="lugares">Lugares</option>
        <option value="actividades">Actividades</option>
        <option value="franjas">Franjas</option>
        <option value="opciones_llevar">Qué llevar</option>
      </select>
      <NuevoItem tabla={tabla} actividades={actividades} onDone={cargar} />
      {items.map((it) => {
        const id = it.id ?? it.slug;
        return (
          <div key={id} className="card p-3 rounded-2xl flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{it.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{it.nombre}</p>
                <p className="text-xs text-salvia">{it.activo ? 'Visible' : 'Oculto'} · orden {it.orden}{tabla === 'lugares' && it.lat == null ? ' · sin ubicación' : ''}</p>
              </div>
              <button onClick={() => setEditando(editando === id ? null : id)} aria-label="Editar" className={`btn-icon w-8 h-8 text-xs ${editando === id ? 'bg-seleccion border-esmeralda' : ''}`}>✏️</button>
              <input type="file" accept="image/*" className="hidden" id={`f-${id}`} onChange={(e) => e.target.files?.[0] && foto(it, e.target.files[0])} />
              {tabla === 'lugares' && (
                <button onClick={() => setUbicando(it)} title="Ubicación en el mapa" className={`btn-icon w-8 h-8 text-xs ${it.lat != null ? 'bg-seleccion border-esmeralda' : 'opacity-60'}`}>📍</button>
              )}
              <label htmlFor={`f-${id}`} className="btn-icon w-8 h-8 text-xs cursor-pointer">📷</label>
              <button onClick={() => mover(it, 1)} className="btn-icon w-8 h-8 text-xs cursor-pointer">↓</button>
              <button onClick={() => mover(it, -1)} className="btn-icon w-8 h-8 text-xs cursor-pointer">↑</button>
              <button onClick={() => toggleActivo(it)} className="badge bg-durazno/30 text-coral py-1.5">{it.activo ? 'Ocultar' : 'Mostrar'}</button>
            </div>
            {editando === id && (
              <EditarItem tabla={tabla} item={it} actividades={actividades} onDone={() => { setEditando(null); cargar(); }} />
            )}
          </div>
        );
      })}
      <AnimatePresence>
        {ubicando && (
          <MapaLugar
            inicial={ubicando.lat != null ? { nombre: ubicando.nombre, direccion: ubicando.zona ?? '', lat: ubicando.lat, lng: ubicando.lng } : null}
            onClose={() => setUbicando(null)}
            onPick={(l) => ubicar(ubicando, l.lat, l.lng)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ChipsActividades({ actividades, sel, setSel }: { actividades: any[]; sel: string[]; setSel: (v: string[]) => void }) {
  return (
    <>
      <p className="text-xs font-bold">Actividades:</p>
      <div className="flex flex-wrap gap-1">
        {actividades.map((a: any) => (
          <button key={a.id} onClick={() => setSel(sel.includes(a.id) ? sel.filter((x) => x !== a.id) : [...sel, a.id])}
            className={`text-xs rounded-full px-2 py-1 ${sel.includes(a.id) ? 'bg-hondo text-white' : 'bg-seleccion text-bosque border border-menta'}`}>{a.nombre}</button>
        ))}
      </div>
    </>
  );
}

function EditarItem({ tabla, item, actividades, onDone }: { tabla: string; item: any; actividades: any[]; onDone: () => void }) {
  const { revisar, confirmar, aviso } = useAvisos();
  const campos = CAMPOS[tabla] ?? [];
  const [datos, setDatos] = useState<any>(() => Object.fromEntries(campos.map(([k]) => [k, item[k] ?? ''])));
  const [selActs, setSelActs] = useState<string[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (tabla !== 'lugares') return;
    supabase.from('lugar_actividad').select('actividad_id').eq('lugar_id', item.id)
      .then(({ data }) => setSelActs((data ?? []).map((d) => d.actividad_id)));
  }, [tabla, item.id]);

  const guardar = async () => {
    if (!String(datos.nombre ?? '').trim()) { aviso('El nombre no puede quedar vacío', 'error'); return; }
    setGuardando(true);
    const [k, v] = llave(item);
    const cambios = { ...datos, nombre: datos.nombre.trim(), ...('nota' in datos ? { nota: datos.nota || null } : {}) };
    const { error } = revisar(await supabase.from(tabla as any).update(cambios).eq(k, v), 'No pude guardar los cambios');
    if (!error && tabla === 'lugares' && selActs) {
      const borrado = revisar(await supabase.from('lugar_actividad').delete().eq('lugar_id', item.id), 'No pude actualizar las actividades');
      if (!borrado.error && selActs.length) {
        revisar(await supabase.from('lugar_actividad').insert(selActs.map((a) => ({ lugar_id: item.id, actividad_id: a }))), 'No pude actualizar las actividades');
      }
    }
    setGuardando(false);
    if (!error) { aviso('Guardado 💚'); onDone(); }
  };

  const borrar = async () => {
    if (!(await confirmar({ titulo: `¿Borrar «${item.nombre}»?`, texto: 'No se puede deshacer. Si solo no quieres que aparezca, mejor ocúltalo.', boton: 'Borrar', peligro: true }))) return;
    const [k, v] = llave(item);
    const { error } = await supabase.from(tabla as any).delete().eq(k, v);
    if (error?.code === EN_USO) { aviso(`«${item.nombre}» ya se usa en alguna cita; mejor ocúltalo`, 'error'); return; }
    revisar({ error }, 'No pude borrarlo');
    if (!error) { aviso('Borrado'); onDone(); }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-menta pt-3">
      {campos.map(([k, etiqueta, tipo]) => (
        <label key={k} className="text-xs font-bold text-salvia">{etiqueta}
          {tipo === 'textarea' ? (
            <textarea value={datos[k]} onChange={(e) => setDatos({ ...datos, [k]: e.target.value })} className="input mt-1 min-h-16 text-sm font-normal text-bosque-oscuro" />
          ) : tipo === 'precio' ? (
            <select value={datos[k]} onChange={(e) => setDatos({ ...datos, [k]: Number(e.target.value) })} className="input mt-1 text-sm">
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{'💰'.repeat(n)}</option>)}
            </select>
          ) : tipo === 'tipo-llevar' ? (
            <select value={datos[k]} onChange={(e) => setDatos({ ...datos, [k]: e.target.value })} className="input mt-1 text-sm">
              <option value="detalle">Detalle</option>
              <option value="vestimenta">Vestimenta</option>
            </select>
          ) : (
            <input value={datos[k]} onChange={(e) => setDatos({ ...datos, [k]: e.target.value })} className="input mt-1 text-sm font-normal text-bosque-oscuro" />
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

function NuevoItem({ tabla, actividades, onDone }: any) {
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
    let error: any = null;
    if (tabla === 'categorias_cita' || tabla === 'categorias_preguntas') {
      ({ error } = revisar(await supabase.from(tabla as any).insert({ slug: slug || nombre.toLowerCase().replaceAll(' ', '-'), nombre, emoji, color: '#8FB39A' }), msg));
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
      {(tabla === 'categorias_cita' || tabla === 'categorias_preguntas') && <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (opcional)" className="input" />}
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

/* ---------- Preguntas ---------- */

function AdminPreguntas() {
  const { revisar, aviso } = useAvisos();
  const [cat, setCat] = useState('');
  const [texto, setTexto] = useState('');
  const [lote, setLote] = useState('');
  const [cats, setCats] = useState<any[]>([]);
  const [preguntas, setPreguntas] = useState<any[]>([]);
  const [buscar, setBuscar] = useState('');
  useEffect(() => { supabase.from('categorias_preguntas').select('*').order('orden').then(({ data }) => setCats(data ?? [])); }, []);

  const cargar = useCallback(async () => {
    if (!cat) { setPreguntas([]); return; }
    const { data } = await supabase.from('preguntas').select('*').eq('categoria_slug', cat).order('texto');
    setPreguntas(data ?? []);
  }, [cat]);
  useEffect(() => { cargar(); }, [cargar]);

  const agregar = async () => {
    if (!texto.trim() || !cat) return;
    const { error } = revisar(await supabase.from('preguntas').insert({ categoria_slug: cat, texto: texto.trim() }), 'No pude agregar la pregunta');
    if (error) return;
    setTexto('');
    aviso('Pregunta agregada 💭');
    cargar();
  };
  const importar = async () => {
    const lineas = lote.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lineas.length || !cat) return;
    const { error } = revisar(await supabase.from('preguntas').insert(lineas.map((l) => ({ categoria_slug: cat, texto: l }))), 'No pude importar el lote');
    if (error) return;
    setLote('');
    aviso(`${lineas.length} ${lineas.length === 1 ? 'pregunta agregada' : 'preguntas agregadas'} 💭`);
    cargar();
  };

  const filtradas = buscar.trim() ? preguntas.filter((p) => p.texto.toLowerCase().includes(buscar.trim().toLowerCase())) : preguntas;

  return (
    <div className="flex flex-col gap-3">
      <select value={cat} onChange={(e) => setCat(e.target.value)} className="input">
        <option value="">Escoge categoría</option>
        {cats.map((c) => <option key={c.slug} value={c.slug}>{c.emoji} {c.nombre}</option>)}
      </select>
      {!cat ? <Vacio titulo="Escoge una categoría" texto="Para ver, editar o agregar preguntas." /> : (
        <>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nueva pregunta" className="input" />
          <button onClick={agregar} disabled={!texto.trim()} className="btn-primary py-2.5">Agregar</button>
          <textarea value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Importación en bloque: una pregunta por línea" className="input h-32" />
          <button onClick={importar} disabled={!lote.trim()} className="btn-soft py-2.5">Importar lote</button>

          <div className="flex items-center justify-between mt-3">
            <p className="eyebrow">{preguntas.length} preguntas</p>
            <p className="text-xs text-salvia">{preguntas.filter((p) => !p.activo).length} desactivadas</p>
          </div>
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar…" className="input" />
          {filtradas.map((p) => <PreguntaItem key={p.id} p={p} onCambio={cargar} />)}
        </>
      )}
    </div>
  );
}

function PreguntaItem({ p, onCambio }: { p: any; onCambio: () => void }) {
  const { revisar, confirmar, aviso } = useAvisos();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(p.texto);

  const guardar = async () => {
    if (!texto.trim()) return;
    const { error } = revisar(await supabase.from('preguntas').update({ texto: texto.trim() }).eq('id', p.id), 'No pude guardar la pregunta');
    if (error) return;
    setEditando(false);
    onCambio();
  };
  const alternar = async () => {
    revisar(await supabase.from('preguntas').update({ activo: !p.activo }).eq('id', p.id), 'No pude cambiarla');
    onCambio();
  };
  const borrar = async () => {
    if (!(await confirmar({ titulo: '¿Borrar esta pregunta?', texto: p.texto, boton: 'Borrar', peligro: true }))) return;
    const { error } = await supabase.from('preguntas').delete().eq('id', p.id);
    if (error?.code === EN_USO) { aviso('Ya salió como pregunta del día; mejor desactívala', 'error'); return; }
    revisar({ error }, 'No pude borrarla');
    if (!error) onCambio();
  };

  return (
    <div className={`card p-3 rounded-2xl flex flex-col gap-2 ${p.activo ? '' : 'opacity-60'}`}>
      {editando ? (
        <>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} className="input min-h-16 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setTexto(p.texto); setEditando(false); }} className="btn-soft py-2">Volver</button>
            <button onClick={guardar} disabled={!texto.trim()} className="btn-primary py-2">Guardar</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">{p.texto}</p>
          <div className="flex gap-4 text-xs font-bold">
            <button onClick={() => setEditando(true)} className="text-bosque">✏️ Editar</button>
            <button onClick={alternar} className="text-salvia">{p.activo ? 'Desactivar' : 'Activar'}</button>
            <button onClick={borrar} className="text-coral ml-auto">Borrar</button>
          </div>
        </>
      )}
    </div>
  );
}

function Fechas() {
  const { revisar } = useAvisos();
  const [fechas, setFechas] = useState<string[]>([]);
  const cargar = async () => { const { data } = await supabase.from('fechas_no_disponibles').select('fecha'); setFechas((data ?? []).map((d) => d.fecha)); };
  useEffect(() => { cargar(); }, []);
  const toggle = async (s: string) => {
    if (fechas.includes(s)) revisar(await supabase.from('fechas_no_disponibles').delete().eq('fecha', s), 'No pude liberar ese día');
    else revisar(await supabase.from('fechas_no_disponibles').insert({ fecha: s }), 'No pude bloquear ese día');
    cargar();
  };
  const base = hoy();
  const dias: string[] = [];
  for (let i = 0; i < 60; i++) { const d = new Date(base); d.setDate(d.getDate() + i); dias.push(fechaStr(d)); }
  return (
    <div>
      <p className="text-sm text-salvia mb-2">Toca los días que no puedes.</p>
      <div className="grid grid-cols-7 gap-1">
        {dias.map((s) => (
          <button key={s} onClick={() => toggle(s)} className={`mx-auto rounded-full w-10 h-10 text-xs font-bold transition active:scale-90 ${fechas.includes(s) ? 'bg-durazno text-coral line-through' : 'bg-seleccion text-bosque border border-menta'}`}>{s.slice(8)}</button>
        ))}
      </div>
    </div>
  );
}

function Config() {
  const { revisar, aviso } = useAvisos();
  const [c, setC] = useState<any>(null);
  useEffect(() => { supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setC(data)); }, []);
  const guardar = async () => {
    // Las fechas vacías van como null (Postgres no acepta '' en una columna date)
    const datos = { ...c, cumple_ella: c.cumple_ella || null, cumple_el: c.cumple_el || null };
    const { error } = revisar(await supabase.from('configuracion').update(datos).eq('id', 1), 'No pude guardar la configuración');
    if (!error) aviso('Guardado 💚');
  };
  if (!c) return null;
  return (
    <div className="flex flex-col gap-2">
      {[['nombre_app', 'Nombre de la app'], ['nombre_ella', 'Nombre de ella'], ['apodo_ella', 'Cómo le dices'], ['nombre_el', 'Tu nombre'], ['fecha_inicio', 'Fecha de inicio', 'date'], ['cumple_ella', 'Cumpleaños de ella', 'date'], ['cumple_el', 'Tu cumpleaños', 'date'], ['whatsapp', 'Tu WhatsApp (sin +)'], ['whatsapp_ella', 'WhatsApp de ella (sin +)'],['color_principal', 'Color principal']].map(([k, l, tipo]) => (
        <label key={k} className="text-sm">{l}
          <input type={tipo ?? 'text'} value={c[k] ?? ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} className="input mt-1" />
        </label>
      ))}
      <button onClick={guardar} className="btn-primary">Guardar</button>
    </div>
  );
}
