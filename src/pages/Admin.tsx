import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fechaBonita, fechaStr, hoy, nombreLugar, linkMapa } from '../lib/utils';
import { AnimatePresence } from 'framer-motion';
import { Encabezado, Segmented, Vacio } from '../components/ui';
import MapaLugar from '../components/MapaLugar';
import EditarCita from '../components/EditarCita';

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
  const [citas, setCitas] = useState<any[]>([]);
  const [filtro, setFiltro] = useState('pendiente');
  const [editando, setEditando] = useState<any>(null);
  const cargar = useCallback(async () => {
    const { data } = await supabase.from('citas').select('*, lugares(nombre), actividades(nombre), franjas(nombre), categorias_cita(nombre)').eq('estado', filtro).order('fecha');
    setCitas(data ?? []);
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  const confirmar = async (c: any, hora: string, nota: string) => {
    await supabase.from('citas').update({ estado: 'confirmada', hora_confirmada: hora || null, nota_admin: nota || null, modificada: false }).eq('id', c.id);
    cargar();
  };
  const cancelar = async (c: any) => {
    const msg = prompt('Mensaje para ella:') ?? '';
    await supabase.from('citas').update({ estado: 'cancelada', nota_admin: msg }).eq('id', c.id);
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

async function subirFotoCatalogo(file: File): Promise<string | null> {
  const ruta = `${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('catalogo').upload(ruta, file, { upsert: true });
  if (error) return null;
  return supabase.storage.from('catalogo').getPublicUrl(ruta).data.publicUrl;
}

function Catalogos() {
  const [tabla, setTabla] = useState<string>('lugares');
  const [items, setItems] = useState<any[]>([]);
  const [actividades, setActividades] = useState<any[]>([]);
  const [ubicando, setUbicando] = useState<any>(null);
  const cargar = useCallback(async () => {
    setItems((await supabase.from(tabla as any).select('*').order('orden')).data ?? []);
    setActividades((await supabase.from('actividades').select('*').order('orden')).data ?? []);
  }, [tabla]);
  useEffect(() => { cargar(); }, [cargar]);

  const toggleActivo = async (it: any) => { await supabase.from(tabla as any).update({ activo: !it.activo }).eq('id' in it ? 'id' : 'slug', ('id' in it ? it.id : it.slug)); cargar(); };
  const mover = async (it: any, dir: number) => { await supabase.from(tabla as any).update({ orden: (it.orden ?? 0) + dir }).eq('id' in it ? 'id' : 'slug', ('id' in it ? it.id : it.slug)); cargar(); };
  const foto = async (it: any, file: File) => {
    const url = await subirFotoCatalogo(file);
    if (url) await supabase.from(tabla as any).update({ imagen_url: url }).eq('id', it.id);
    cargar();
  };
  const ubicar = async (it: any, lat: number, lng: number) => {
    await supabase.from('lugares').update({ lat, lng }).eq('id', it.id);
    setUbicando(null);
    cargar();
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
      {items.map((it) => (
        <div key={it.id ?? it.slug} className="card p-3 rounded-2xl flex items-center gap-2">
          <span className="text-2xl">{it.emoji}</span>
          <div className="flex-1">
            <p className="font-bold text-sm">{it.nombre}</p>
            <p className="text-xs text-salvia">{it.activo ? 'Visible' : 'Oculto'} · orden {it.orden}{tabla === 'lugares' && it.lat == null ? ' · sin ubicación' : ''}</p>
          </div>
          <input type="file" accept="image/*" className="hidden" id={`f-${it.id ?? it.slug}`} onChange={(e) => e.target.files?.[0] && foto(it, e.target.files[0])} />
          {tabla === 'lugares' && (
            <button onClick={() => setUbicando(it)} title="Ubicación en el mapa" className={`btn-icon w-8 h-8 text-xs ${it.lat != null ? 'bg-seleccion border-esmeralda' : 'opacity-60'}`}>📍</button>
          )}
          <label htmlFor={`f-${it.id ?? it.slug}`} className="btn-icon w-8 h-8 text-xs cursor-pointer">📷</label>
          <button onClick={() => mover(it, 1)} className="btn-icon w-8 h-8 text-xs cursor-pointer">↓</button>
          <button onClick={() => mover(it, -1)} className="btn-icon w-8 h-8 text-xs cursor-pointer">↑</button>
          <button onClick={() => toggleActivo(it)} className="badge bg-durazno/30 text-coral py-1.5">{it.activo ? 'Ocultar' : 'Mostrar'}</button>
        </div>
      ))}
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

function NuevoItem({ tabla, actividades, onDone }: any) {
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [slug, setSlug] = useState('');
  const [categoria, setCategoria] = useState('');
  const [selActs, setSelActs] = useState<string[]>([]);
  const [abierto, setAbierto] = useState(false);

  const guardar = async () => {
    if (!nombre) return;
    if (tabla === 'categorias_cita' || tabla === 'categorias_preguntas') {
      await supabase.from(tabla as any).insert({ slug: slug || nombre.toLowerCase().replaceAll(' ', '-'), nombre, emoji, color: '#8FB39A' });
    } else if (tabla === 'lugares') {
      const { data } = await supabase.from('lugares').insert({ nombre, emoji, categorias: categoria ? [categoria] : [], precio: 2, duracion: 'Medio día' }).select().single();
      for (const a of selActs) await supabase.from('lugar_actividad').insert({ lugar_id: data.id, actividad_id: a });
    } else if (tabla === 'actividades') {
      await supabase.from('actividades').insert({ nombre, emoji, precio: 2 });
    } else if (tabla === 'franjas') {
      await supabase.from('franjas').insert({ nombre, emoji, horario: '' });
    } else {
      await supabase.from('opciones_llevar').insert({ tipo: 'detalle', nombre, emoji });
    }
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
          <p className="text-xs font-bold">Actividades:</p>
          <div className="flex flex-wrap gap-1">
            {actividades.map((a: any) => (
              <button key={a.id} onClick={() => setSelActs(selActs.includes(a.id) ? selActs.filter((x) => x !== a.id) : [...selActs, a.id])}
                className={`text-xs rounded-full px-2 py-1 ${selActs.includes(a.id) ? 'bg-bosque text-white' : 'bg-seleccion text-bosque border border-menta'}`}>{a.nombre}</button>
            ))}
          </div>
        </>
      )}
      <button onClick={guardar} className="btn-primary py-2.5">Guardar</button>
    </div>
  ) : (
    <button onClick={() => setAbierto(true)} className="btn-soft py-2.5 border-dashed">+ Agregar</button>
  );
}

function AdminPreguntas() {
  const [cat, setCat] = useState('');
  const [texto, setTexto] = useState('');
  const [lote, setLote] = useState('');
  const [cats, setCats] = useState<any[]>([]);
  useEffect(() => { supabase.from('categorias_preguntas').select('*').order('orden').then(({ data }) => setCats(data ?? [])); }, []);

  const agregar = async () => {
    if (!texto || !cat) return;
    await supabase.from('preguntas').insert({ categoria_slug: cat, texto });
    setTexto('');
  };
  const importar = async () => {
    const lineas = lote.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const l of lineas) await supabase.from('preguntas').insert({ categoria_slug: cat, texto: l });
    setLote('');
  };

  return (
    <div className="flex flex-col gap-3">
      <select value={cat} onChange={(e) => setCat(e.target.value)} className="input">
        <option value="">Escoge categoría</option>
        {cats.map((c) => <option key={c.slug} value={c.slug}>{c.nombre}</option>)}
      </select>
      <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nueva pregunta" className="input" />
      <button onClick={agregar} className="btn-primary py-2.5">Agregar</button>
      <textarea value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Importación en bloque: una pregunta por línea" className="input h-32" />
      <button onClick={importar} className="btn-soft py-2.5">Importar lote</button>
    </div>
  );
}

function Fechas() {
  const [fechas, setFechas] = useState<string[]>([]);
  const cargar = async () => { const { data } = await supabase.from('fechas_no_disponibles').select('fecha'); setFechas((data ?? []).map((d) => d.fecha)); };
  useEffect(() => { cargar(); }, []);
  const toggle = async (s: string) => {
    if (fechas.includes(s)) await supabase.from('fechas_no_disponibles').delete().eq('fecha', s);
    else await supabase.from('fechas_no_disponibles').insert({ fecha: s });
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
  const [c, setC] = useState<any>(null);
  useEffect(() => { supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setC(data)); }, []);
  const guardar = async () => {
    // Las fechas vacías van como null (Postgres no acepta '' en una columna date)
    const datos = { ...c, cumple_ella: c.cumple_ella || null, cumple_el: c.cumple_el || null };
    await supabase.from('configuracion').update(datos).eq('id', 1);
    alert('Guardado 💚');
  };
  if (!c) return null;
  return (
    <div className="flex flex-col gap-2">
      {[['nombre_app', 'Nombre de la app'], ['nombre_ella', 'Nombre de ella'], ['apodo_ella', 'Cómo le dices'], ['nombre_el', 'Tu nombre'], ['fecha_inicio', 'Fecha de inicio', 'date'], ['cumple_ella', 'Cumpleaños de ella', 'date'], ['cumple_el', 'Tu cumpleaños', 'date'], ['whatsapp', 'Tu WhatsApp (sin +)'], ['color_principal', 'Color principal']].map(([k, l, tipo]) => (
        <label key={k} className="text-sm">{l}
          <input type={tipo ?? 'text'} value={c[k] ?? ''} onChange={(e) => setC({ ...c, [k]: e.target.value })} className="input mt-1" />
        </label>
      ))}
      <button onClick={guardar} className="btn-primary">Guardar</button>
    </div>
  );
}
