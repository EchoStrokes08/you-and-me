import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fechaBonita, diasEntre, hoyStr, nombreLugar } from '../lib/utils';
import Ballena, { Olas } from '../components/Ballena';
import MapaLugar, { type LugarMapa } from '../components/MapaLugar';
import { Contador, Corazon, Encabezado, IconoCheck, IconoMas, Vacio } from '../components/ui';

export default function Historia() {
  const { perfil } = useAuth();
  // Viene de Juntos → "Guardarlo como recuerdo"
  const sueno = (useLocation().state as any)?.sueno ?? null;
  const navigate = useNavigate();
  const [config, setConfig] = useState<any>(null);
  const [recuerdos, setRecuerdos] = useState<any[]>([]);
  const [fotos, setFotos] = useState<Record<string, string[]>>({});
  const [creando, setCreando] = useState(!!sueno);
  const [citasVivibles, setCitasVivibles] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const cargar = async () => {
    supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setConfig(data));
    const { data } = await supabase.from('recuerdos').select('*').order('fecha', { ascending: false });
    setRecuerdos(data ?? []);
    const { data: fs } = await supabase.from('fotos_recuerdo').select('*').order('orden');
    const map: Record<string, string[]> = {};
    for (const f of fs ?? []) {
      const { data: url } = await supabase.storage.from('recuerdos').createSignedUrl(f.ruta, 3600);
      (map[f.recuerdo_id] ??= []).push(url?.signedUrl ?? '');
    }
    setFotos(map);
    const { data: cv } = await supabase.from('citas').select('id, fecha, lugar_personalizado, lugar_direccion, lugar_lat, lugar_lng, lugares(nombre, lat, lng), actividades(nombre)').eq('estado', 'confirmada').lt('fecha', hoyStr());
    setCitasVivibles(cv ?? []);
    const { data: viv } = await supabase.from('citas').select('categoria_slug, lugares(nombre)').eq('estado', 'vivida');
    const conteo: any = {}; const lugaresC: any = {};
    for (const c of (viv as any[]) ?? []) { conteo[c.categoria_slug] = (conteo[c.categoria_slug] ?? 0) + 1; const ln = (c.lugares as any)?.nombre; if (ln) lugaresC[ln] = (lugaresC[ln] ?? 0) + 1; }
    const topCat = Object.entries(conteo).sort((a: any, b: any) => b[1] - a[1])[0]?.[0];
    const topLugar = Object.entries(lugaresC).sort((a: any, b: any) => b[1] - a[1])[0]?.[0];
    setStats({ total: viv?.length ?? 0, topCat, topLugar });
  };
  useEffect(() => { cargar(); }, []);

  const diasJuntos = config ? -diasEntre(config.fecha_inicio) : 0;
  const hitos = [100, 180, 365, 500, 730, 1000, 1095, 1500, 2000];
  const proximo = hitos.find((h) => h > diasJuntos);
  const anterior = [...hitos].reverse().find((h) => h <= diasJuntos) ?? 0;
  const progreso = proximo ? (diasJuntos - anterior) / (proximo - anterior) : 1;

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Encabezado eyebrow="Lo que hemos vivido" titulo="Nuestra historia">
        <Link to="/lugares" className="chip shrink-0">🗺️ Mapa</Link>
      </Encabezado>

      <section className="card-hero pb-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow text-lima">Llevamos</p>
            <p className="font-titulo text-6xl font-bold leading-none mt-1 tabular-nums"><Contador valor={diasJuntos} /></p>
            <p className="font-semibold text-white/85">días juntos 💚</p>
          </div>
          <Ballena className="w-28 -mr-2 drop-shadow-lg" color="#CFE9E4" panza="#FFFFFF" />
        </div>
        {proximo && (
          <div className="mt-5 relative">
            <div className="flex justify-between text-xs font-bold text-white/80 mb-1.5">
              <span>Próximo hito: {proximo} días 🎉</span>
              <span>faltan {proximo - diasJuntos}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(4, progreso * 100)}%` }} transition={{ duration: 1.1, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-lima to-espuma" />
            </div>
          </div>
        )}
        <Olas className="absolute bottom-0 inset-x-0 h-6" color="#CFE9E4" opacidad={0.2} />
      </section>

      {stats && (
        <div className="grid grid-cols-3 gap-2 stagger">
          {[
            ['Citas vividas', stats.total, '💚'],
            ['Plan favorito', stats.topCat ?? '—', '⭐'],
            ['Lugar más repetido', stats.topLugar ?? '—', '📍'],
          ].map(([l, v, e]) => (
            <div key={l} className="card p-3 text-center">
              <p className="text-lg">{e}</p>
              <p className="font-titulo text-lg font-bold text-bosque leading-tight truncate capitalize">{v}</p>
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-salvia leading-tight mt-0.5">{l}</p>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setCreando(!creando)} className={creando ? 'btn-soft' : 'btn-primary'}>
        <motion.span animate={{ rotate: creando ? 45 : 0 }}><IconoMas /></motion.span>
        {creando ? 'Cerrar' : 'Nuevo recuerdo'}
      </button>
      <AnimatePresence>
        {creando && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <NuevoRecuerdo perfil={perfil} citas={citasVivibles} inicial={sueno} onDone={() => { setCreando(false); if (sueno) navigate('/historia', { replace: true, state: null }); cargar(); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {recuerdos.length === 0 ? (
        <Vacio titulo="Aún no hay recuerdos" texto="¡Creen el primero! Cada cita vivida puede quedarse aquí para siempre 📸" />
      ) : (
        <div className="relative ml-3 pl-6 flex flex-col gap-4 stagger before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-esmeralda before:via-menta before:to-transparent">
          {recuerdos.map((r) => <RecuerdoCard key={r.id} r={r} fotos={fotos[r.id] ?? []} perfil={perfil} />)}
        </div>
      )}
    </div>
  );
}

function RecuerdoCard({ r, fotos, perfil }: any) {
  const [open, setOpen] = useState(false);
  const [notas, setNotas] = useState<any[]>([]);
  const [texto, setTexto] = useState('');
  useEffect(() => {
    if (open) supabase.from('notas_recuerdo').select('*').eq('recuerdo_id', r.id).then(({ data }) => setNotas(data ?? []));
  }, [open, r.id]);
  const guardarNota = async () => {
    if (!texto.trim()) return;
    await supabase.from('notas_recuerdo').insert({ recuerdo_id: r.id, usuario_id: perfil.id, texto });
    setTexto('');
    supabase.from('notas_recuerdo').select('*').eq('recuerdo_id', r.id).then(({ data }) => setNotas(data ?? []));
  };
  return (
    <div className="relative card p-0 overflow-visible">
      <span className="absolute -left-[31px] top-5 w-4 h-4 rounded-full bg-tarjeta border-[3px] border-esmeralda shadow" />
      <button onClick={() => setOpen(!open)} className="text-left w-full" aria-expanded={open}>
        {fotos[0] && (
          <div className="relative">
            <img src={fotos[0]} className="rounded-t-[1.75rem] w-full h-48 object-cover" />
            {fotos.length > 1 && <span className="absolute top-3 right-3 badge bg-pino/70 text-white backdrop-blur">📷 {fotos.length}</span>}
          </div>
        )}
        <div className="p-4">
          <p className="eyebrow capitalize">{fechaBonita(r.fecha)}</p>
          <p className="font-titulo text-lg font-semibold leading-tight mt-0.5">{r.titulo}</p>
          {r.lugar_texto && <p className="text-sm text-salvia">📍 {r.lugar_texto}</p>}
          <div className="flex gap-0.5 mt-2 text-esmeralda">{[1, 2, 3, 4, 5].map((n) => <Corazon key={n} className="w-4 h-4" lleno={n <= r.calificacion} />)}</div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 flex flex-col gap-3">
              {fotos.length > 1 && (
                <div className="flex overflow-x-auto gap-2 snap-x -mx-4 px-4">
                  {fotos.map((f: string, i: number) => <img key={i} src={f} className="rounded-2xl w-40 h-40 object-cover flex-shrink-0 snap-start" />)}
                </div>
              )}
              {r.descripcion && <p className="text-sm leading-relaxed">{r.descripcion}</p>}
              {notas.map((n) => (
                <p key={n.id} className="text-sm bg-seleccion border border-menta rounded-2xl px-3 py-2"><span className="eyebrow block">Lo mejor para mí</span>{n.texto}</p>
              ))}
              <div className="flex gap-2">
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Lo mejor para mí fue…" className="input py-2 text-sm" />
                <button onClick={guardarNota} className="btn-primary px-3 py-2" aria-label="Guardar nota"><IconoCheck /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NuevoRecuerdo({ perfil, citas, inicial, onDone }: any) {
  const [citaId, setCitaId] = useState('');
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [fecha, setFecha] = useState(inicial?.fecha ?? '');
  const [lugar, setLugar] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [calificacion, setCalificacion] = useState(5);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [ubicacion, setUbicacion] = useState<LugarMapa | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const elegirCita = (id: string) => {
    setCitaId(id);
    const c = citas.find((x: any) => x.id === id);
    if (c) { setFecha(c.fecha); setLugar(nombreLugar(c) ?? ''); setTitulo(c.actividades?.nombre ?? 'Nuestra cita'); }
    // La ubicación de la cita (mapa o catálogo) pasa al recuerdo
    const lat = c?.lugar_lat ?? c?.lugares?.lat, lng = c?.lugar_lng ?? c?.lugares?.lng;
    setUbicacion(c && lat != null && lng != null ? { nombre: nombreLugar(c) ?? '', direccion: c.lugar_direccion ?? '', lat, lng } : null);
  };

  const comprimir = async (file: File): Promise<Blob> => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((r) => (img.onload = r));
    const max = 1600;
    const escala = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = img.width * escala;
    canvas.height = img.height * escala;
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.8));
  };

  const guardar = async () => {
    if (!titulo || !fecha) return;
    setGuardando(true);
    const { data } = await supabase.from('recuerdos').insert({ cita_id: citaId || null, titulo, fecha, lugar_texto: lugar, descripcion, calificacion, creado_por: perfil.id, lat: ubicacion?.lat ?? null, lng: ubicacion?.lng ?? null }).select().single();
    if (data) {
      let orden = 0;
      for (const f of archivos.slice(0, 10)) {
        const blob = await comprimir(f);
        const ruta = `${data.id}/${Date.now()}-${orden}.jpg`;
        await supabase.storage.from('recuerdos').upload(ruta, blob, { contentType: 'image/jpeg' });
        await supabase.from('fotos_recuerdo').insert({ recuerdo_id: data.id, ruta, orden: orden++ });
      }
      if (citaId) await supabase.from('citas').update({ estado: 'vivida' }).eq('id', citaId);
      if (inicial?.id) await supabase.from('suenos').update({ recuerdo_id: data.id }).eq('id', inicial.id);
    }
    setGuardando(false);
    onDone();
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      <select value={citaId} onChange={(e) => elegirCita(e.target.value)} className="input">
        <option value="">Desde cero (sin cita de la app)</option>
        {citas.map((c: any) => <option key={c.id} value={c.id}>{c.fecha} — {nombreLugar(c)}</option>)}
      </select>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" />
        <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Lugar" className="input" />
      </div>
      <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="¿Cómo nos fue?" className="input min-h-24" />
      <div>
        <p className="eyebrow mb-1">¿Qué tal estuvo?</p>
        <div className="flex gap-1 text-esmeralda">
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.button key={n} whileTap={{ scale: 1.3 }} onClick={() => setCalificacion(n)} aria-label={`${n} corazones`}>
              <Corazon className="w-8 h-8" lleno={n <= calificacion} />
            </motion.button>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => setMapaAbierto(true)} className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left ${ubicacion ? 'border-esmeralda bg-seleccion' : 'border-dashed border-menta bg-tarjeta'}`}>
        <span className="text-2xl">🗺️</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-bosque">{ubicacion ? 'En nuestro mapa ✓' : 'Marcar en nuestro mapa'}</span>
          <span className="block text-xs text-salvia truncate">{ubicacion ? (ubicacion.direccion || ubicacion.nombre || 'Toca para cambiar') : 'Opcional: para que aparezca en Lugares'}</span>
        </span>
      </button>
      <AnimatePresence>
        {mapaAbierto && (
          <MapaLugar inicial={ubicacion} onClose={() => setMapaAbierto(false)}
            onPick={(l) => { setUbicacion(l); if (!lugar) setLugar(l.nombre); setMapaAbierto(false); }} />
        )}
      </AnimatePresence>
      <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-menta bg-seleccion/60 p-4 cursor-pointer active:bg-seleccion">
        <span className="text-2xl">📷</span>
        <span className="flex-1">
          <span className="block font-bold text-bosque">{archivos.length ? `${archivos.length} foto${archivos.length > 1 ? 's' : ''} lista${archivos.length > 1 ? 's' : ''}` : 'Agregar fotos'}</span>
          <span className="block text-xs text-salvia">Hasta 10, las comprimo por ti</span>
        </span>
        <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setArchivos(Array.from(e.target.files ?? []))} />
      </label>
      <button onClick={guardar} disabled={guardando || !titulo || !fecha} className="btn-primary">{guardando ? 'Guardando…' : 'Guardar recuerdo 📸'}</button>
    </div>
  );
}
