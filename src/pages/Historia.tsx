import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fechaBonita, diasEntre, hoyStr, nombreLugar } from '../lib/utils';
import { borrarFotos, subirFotos, urlsFirmadas, MAX_FOTOS, type Foto } from '../lib/fotos';
import Ballena, { Olas } from '../components/Ballena';
import MapaLugar, { type LugarMapa } from '../components/MapaLugar';
import Cancion from '../components/Cancion';
import CopiaSeguridad from '../components/CopiaSeguridad';
import { useAvisos } from '../lib/avisos';
import { Contador, Corazon, Encabezado, IconoCerrar, IconoCheck, IconoMas, Vacio } from '../components/ui';

export default function Historia() {
  const { perfil } = useAuth();
  const { confirmar, revisar, aviso } = useAvisos();
  // Viene de Juntos → "Guardarlo como recuerdo"
  const estado = useLocation().state as any;
  const sueno = estado?.sueno ?? null;
  // Viene de "Un día como hoy": abrir ese recuerdo
  const abrir: string | null = estado?.abrir ?? null;
  const navigate = useNavigate();
  const [config, setConfig] = useState<any>(null);
  const [recuerdos, setRecuerdos] = useState<any[]>([]);
  const [fotos, setFotos] = useState<Record<string, Foto[]>>({});
  const [creando, setCreando] = useState(!!sueno);
  const [citasVivibles, setCitasVivibles] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [filtro, setFiltroEstado] = useState<Filtro>(SIN_FILTRO);
  const [limite, setLimite] = useState(POR_PAGINA);
  // Al buscar o filtrar se vuelve a empezar desde los primeros
  const setFiltro = (f: Filtro) => { setFiltroEstado(f); setLimite(POR_PAGINA); };

  const visibles = useMemo(() => {
    const q = normalizar(filtro.texto.trim());
    return recuerdos.filter((r) =>
      (!q || normalizar(`${r.titulo} ${r.descripcion} ${r.lugar_texto}`).includes(q))
      && (!filtro.anio || r.fecha.startsWith(filtro.anio))
      && r.calificacion >= filtro.corazones
      && (!filtro.conFotos || (fotos[r.id]?.length ?? 0) > 0));
  }, [recuerdos, fotos, filtro]);

  // Si se viene a abrir un recuerdo viejo ("Un día como hoy", Resumen), mostrar hasta él
  const iAbrir = abrir ? visibles.findIndex((r) => r.id === abrir) : -1;
  const mostrados = visibles.slice(0, Math.max(limite, iAbrir + 1));
  const faltan = visibles.length - mostrados.length;

  const cargar = async () => {
    supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setConfig(data));
    const { data } = await supabase.from('recuerdos').select('*').order('fecha', { ascending: false });
    setRecuerdos(data ?? []);
    const { data: fs } = await supabase.from('fotos_recuerdo').select('*').order('orden');
    const urls = await urlsFirmadas((fs ?? []).map((f) => f.ruta));
    const map: Record<string, Foto[]> = {};
    for (const f of fs ?? []) (map[f.recuerdo_id] ??= []).push({ id: f.id, ruta: f.ruta, url: urls[f.ruta] ?? '', orden: f.orden });
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

  const borrar = async (r: any) => {
    const n = fotos[r.id]?.length ?? 0;
    const ok = await confirmar({
      titulo: `¿Borrar «${r.titulo}»?`,
      texto: `Se borran ${n ? `sus ${n} ${n === 1 ? 'foto' : 'fotos'} y ` : ''}las notas. No se puede deshacer.`,
      boton: 'Borrar recuerdo', peligro: true,
    });
    if (!ok) return;
    // Primero las fotos: después de borrar el recuerdo ya no se sabría de quién eran
    if (!(await borrarFotos(fotos[r.id] ?? []))) { aviso('No pude borrar las fotos 😢 El recuerdo sigue igual.', 'error'); cargar(); return; }
    const { error } = revisar(await supabase.from('recuerdos').delete().eq('id', r.id), 'No pude borrar el recuerdo');
    if (!error) aviso('Recuerdo borrado');
    cargar();
  };

  const diasJuntos = config ? -diasEntre(config.fecha_inicio) : 0;
  const hitos = [100, 180, 365, 500, 730, 1000, 1095, 1500, 2000];
  const proximo = hitos.find((h) => h > diasJuntos);
  const anterior = [...hitos].reverse().find((h) => h <= diasJuntos) ?? 0;
  const progreso = proximo ? (diasJuntos - anterior) / (proximo - anterior) : 1;

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Encabezado eyebrow="Lo que hemos vivido" titulo="Nuestra historia">
        <div className="flex gap-2 shrink-0">
          <Link to="/resumen" className="chip">✨ Resumen</Link>
          <Link to="/lugares" className="chip">🗺️ Mapa</Link>
        </div>
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
            <FormRecuerdo perfil={perfil} citas={citasVivibles} inicial={sueno} onDone={() => { setCreando(false); if (sueno) navigate('/historia', { replace: true, state: null }); cargar(); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {recuerdos.length > 2 && (
        <Filtros recuerdos={recuerdos} filtro={filtro} setFiltro={setFiltro} visibles={visibles.length} />
      )}

      {recuerdos.length === 0 ? (
        <Vacio titulo="Aún no hay recuerdos" texto="¡Creen el primero! Cada cita vivida puede quedarse aquí para siempre 📸" />
      ) : visibles.length === 0 ? (
        <Vacio titulo="No encontré recuerdos así" texto="Prueba con otra palabra o quita algún filtro 🔍">
          <button onClick={() => setFiltro(SIN_FILTRO)} className="btn-soft mt-4">Quitar filtros</button>
        </Vacio>
      ) : (
        <div className="relative ml-3 pl-6 flex flex-col gap-4 stagger before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-esmeralda before:via-menta before:to-transparent">
          {mostrados.map((r) => (
            <RecuerdoCard key={r.id} r={r} fotos={fotos[r.id] ?? []} perfil={perfil} destacado={r.id === abrir}
              puedeEditar={!!perfil && (r.creado_por === perfil.id || perfil.rol === 'admin')}
              onCambio={cargar} onBorrar={() => borrar(r)} />
          ))}
        </div>
      )}
      {faltan > 0 && (
        <button onClick={() => setLimite(mostrados.length + POR_PAGINA)} className="btn-soft">
          Ver más recuerdos ({faltan})
        </button>
      )}

      <CopiaSeguridad />
    </div>
  );
}

const POR_PAGINA = 20;

type Filtro = { texto: string; anio: string; corazones: number; conFotos: boolean };
const SIN_FILTRO: Filtro = { texto: '', anio: '', corazones: 0, conFotos: false };

// Sin tildes ni mayúsculas: "medellin" encuentra "Medellín"
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Filtros({ recuerdos, filtro, setFiltro, visibles }: { recuerdos: any[]; filtro: Filtro; setFiltro: (f: Filtro) => void; visibles: number }) {
  const anios = useMemo(() => [...new Set(recuerdos.map((r) => r.fecha.slice(0, 4)))].sort().reverse(), [recuerdos]);
  const activo = filtro.texto.trim() || filtro.anio || filtro.corazones || filtro.conFotos;
  const cambiar = (c: Partial<Filtro>) => setFiltro({ ...filtro, ...c });
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-salvia" aria-hidden="true">🔍</span>
        <input value={filtro.texto} onChange={(e) => cambiar({ texto: e.target.value })} placeholder="Buscar un recuerdo, un lugar…" className="input pl-11" type="search" aria-label="Buscar recuerdos" />
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
        {anios.length > 1 && anios.map((a) => (
          <button key={a} onClick={() => cambiar({ anio: filtro.anio === a ? '' : a })} data-active={filtro.anio === a} className="chip shrink-0">{a}</button>
        ))}
        <button onClick={() => cambiar({ corazones: filtro.corazones === 5 ? 0 : 5 })} data-active={filtro.corazones === 5} className="chip shrink-0">💚 5 corazones</button>
        <button onClick={() => cambiar({ conFotos: !filtro.conFotos })} data-active={filtro.conFotos} className="chip shrink-0">📷 Con fotos</button>
      </div>
      {activo && (
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-salvia">{visibles} de {recuerdos.length} recuerdos</span>
          <button onClick={() => setFiltro(SIN_FILTRO)} className="text-bosque">Quitar filtros</button>
        </div>
      )}
    </div>
  );
}

function RecuerdoCard({ r, fotos, perfil, destacado = false, puedeEditar, onCambio, onBorrar }: {
  r: any; fotos: Foto[]; perfil: any; destacado?: boolean; puedeEditar: boolean; onCambio: () => void; onBorrar: () => void;
}) {
  const { revisar } = useAvisos();
  const [open, setOpen] = useState(destacado);
  const [editando, setEditando] = useState(false);
  const [notas, setNotas] = useState<any[]>([]);
  const [canciones, setCanciones] = useState<any[]>([]);
  const [texto, setTexto] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (destacado) setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }, [destacado]);
  useEffect(() => {
    if (!open) return;
    supabase.from('notas_recuerdo').select('*').eq('recuerdo_id', r.id).then(({ data }) => setNotas(data ?? []));
    supabase.from('canciones').select('*').eq('recuerdo_id', r.id).then(({ data }) => setCanciones(data ?? []));
  }, [open, r.id]);
  const guardarNota = async () => {
    if (!texto.trim()) return;
    const { error } = revisar(await supabase.from('notas_recuerdo').insert({ recuerdo_id: r.id, usuario_id: perfil.id, texto }), 'No pude guardar la nota');
    if (error) return;
    setTexto('');
    supabase.from('notas_recuerdo').select('*').eq('recuerdo_id', r.id).then(({ data }) => setNotas(data ?? []));
  };

  if (editando) {
    return (
      <div ref={ref} className="relative">
        <span className="absolute -left-[31px] top-5 w-4 h-4 rounded-full bg-tarjeta border-[3px] border-esmeralda shadow" />
        <FormRecuerdo perfil={perfil} existente={r} fotosExistentes={fotos}
          onCancelar={() => setEditando(false)} onDone={() => { setEditando(false); onCambio(); }} />
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative card p-0 overflow-visible ${destacado ? 'ring-2 ring-esmeralda' : ''}`}>
      <span className="absolute -left-[31px] top-5 w-4 h-4 rounded-full bg-tarjeta border-[3px] border-esmeralda shadow" />
      <button onClick={() => setOpen(!open)} className="text-left w-full" aria-expanded={open}>
        {fotos[0] && (
          <div className="relative">
            <img src={fotos[0].url} loading="lazy" decoding="async" alt="" className="rounded-t-[1.75rem] w-full h-48 object-cover" />
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
                  {fotos.map((f) => <img key={f.id} src={f.url} loading="lazy" decoding="async" alt="" className="rounded-2xl w-40 h-40 object-cover flex-shrink-0 snap-start" />)}
                </div>
              )}
              {r.descripcion && <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.descripcion}</p>}
              {canciones.map((c) => <Cancion key={c.id} c={c} />)}
              {notas.map((n) => (
                <p key={n.id} className="text-sm bg-seleccion border border-menta rounded-2xl px-3 py-2"><span className="eyebrow block">Lo mejor para mí</span>{n.texto}</p>
              ))}
              <div className="flex gap-2">
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Lo mejor para mí fue…" className="input py-2 text-sm" />
                <button onClick={guardarNota} className="btn-primary px-3 py-2" aria-label="Guardar nota"><IconoCheck /></button>
              </div>
              {puedeEditar && (
                <div className="flex gap-4 text-sm font-bold pt-1">
                  <button onClick={() => setEditando(true)} className="text-bosque">✏️ Editar o cambiar fotos</button>
                  <button onClick={onBorrar} className="text-coral ml-auto">Borrar</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Crea un recuerdo nuevo o, con `existente`, edita uno (datos y fotos)
function FormRecuerdo({ perfil, citas = [], inicial, existente, fotosExistentes = [], onDone, onCancelar }: {
  perfil: any; citas?: any[]; inicial?: any; existente?: any; fotosExistentes?: Foto[]; onDone: () => void; onCancelar?: () => void;
}) {
  const { revisar, aviso } = useAvisos();
  const [citaId, setCitaId] = useState('');
  const [titulo, setTitulo] = useState(existente?.titulo ?? inicial?.titulo ?? '');
  const [fecha, setFecha] = useState(existente?.fecha ?? inicial?.fecha ?? '');
  const [lugar, setLugar] = useState(existente?.lugar_texto ?? '');
  const [descripcion, setDescripcion] = useState(existente?.descripcion ?? '');
  const [calificacion, setCalificacion] = useState(existente?.calificacion ?? 5);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [quitar, setQuitar] = useState<Set<string>>(new Set());
  const [ubicacion, setUbicacion] = useState<LugarMapa | null>(
    existente?.lat != null && existente?.lng != null ? { nombre: existente.lugar_texto ?? '', direccion: '', lat: existente.lat, lng: existente.lng } : null,
  );
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const quedan = fotosExistentes.filter((f) => !quitar.has(f.id)).length;
  const cupo = Math.max(0, MAX_FOTOS - quedan);

  const elegirCita = (id: string) => {
    setCitaId(id);
    const c = citas.find((x: any) => x.id === id);
    if (c) { setFecha(c.fecha); setLugar(nombreLugar(c) ?? ''); setTitulo(c.actividades?.nombre ?? 'Nuestra cita'); }
    // La ubicación de la cita (mapa o catálogo) pasa al recuerdo
    const lat = c?.lugar_lat ?? c?.lugares?.lat, lng = c?.lugar_lng ?? c?.lugares?.lng;
    setUbicacion(c && lat != null && lng != null ? { nombre: nombreLugar(c) ?? '', direccion: c.lugar_direccion ?? '', lat, lng } : null);
  };

  const alternarQuitar = (id: string) => {
    const s = new Set(quitar);
    if (s.has(id)) s.delete(id); else s.add(id);
    setQuitar(s);
  };

  const guardar = async () => {
    if (!titulo || !fecha) return;
    setGuardando(true);
    const campos = { titulo, fecha, lugar_texto: lugar, descripcion, calificacion, lat: ubicacion?.lat ?? null, lng: ubicacion?.lng ?? null };
    let id: string | null = existente?.id ?? null;

    if (existente) {
      const { error } = revisar(await supabase.from('recuerdos').update(campos).eq('id', existente.id), 'No pude guardar los cambios');
      if (error) { setGuardando(false); return; }
      if (quitar.size && !(await borrarFotos(fotosExistentes.filter((f) => quitar.has(f.id))))) {
        aviso('Guardé los cambios, pero no pude quitar alguna foto 😢', 'error');
      }
    } else {
      const { data, error } = revisar(await supabase.from('recuerdos').insert({ ...campos, cita_id: citaId || null, creado_por: perfil.id }).select().single(), 'No pude guardar el recuerdo');
      if (error || !data) { setGuardando(false); return; }
      id = data.id;
      if (citaId) revisar(await supabase.from('citas').update({ estado: 'vivida' }).eq('id', citaId), 'No pude marcar la cita como vivida');
      if (inicial?.id) revisar(await supabase.from('suenos').update({ recuerdo_id: data.id }).eq('id', inicial.id), 'No pude enlazar el plan con el recuerdo');
    }

    if (id && archivos.length) {
      // Las nuevas van después de las que ya había
      const desde = fotosExistentes.length ? Math.max(...fotosExistentes.map((f) => f.orden)) + 1 : 0;
      const fallidas = await subirFotos(id, archivos.slice(0, cupo), desde);
      if (fallidas) aviso(`${fallidas} ${fallidas === 1 ? 'foto no se subió' : 'fotos no se subieron'} 😢 Intenta agregarlas otra vez.`, 'error');
    }
    setGuardando(false);
    aviso(existente ? 'Recuerdo actualizado 💚' : 'Recuerdo guardado 📸');
    onDone();
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      {existente ? (
        <div className="flex items-center justify-between">
          <p className="eyebrow">Editar recuerdo</p>
          <button onClick={onCancelar} className="btn-icon w-8 h-8" aria-label="Cerrar sin guardar"><IconoCerrar className="w-4 h-4" /></button>
        </div>
      ) : (
        <select value={citaId} onChange={(e) => elegirCita(e.target.value)} className="input">
          <option value="">Desde cero (sin cita de la app)</option>
          {citas.map((c: any) => <option key={c.id} value={c.id}>{c.fecha} — {nombreLugar(c)}</option>)}
        </select>
      )}
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

      {fotosExistentes.length > 0 && (
        <div>
          <p className="eyebrow mb-1">Fotos · toca ✕ para quitar</p>
          <div className="grid grid-cols-4 gap-2">
            {fotosExistentes.map((f) => (
              <button key={f.id} type="button" onClick={() => alternarQuitar(f.id)} className="relative aspect-square" aria-label={quitar.has(f.id) ? 'Dejar la foto' : 'Quitar la foto'}>
                <img src={f.url} className={`w-full h-full object-cover rounded-xl transition ${quitar.has(f.id) ? 'opacity-30 grayscale' : ''}`} />
                <span className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow ${quitar.has(f.id) ? 'bg-esmeralda text-white' : 'bg-tarjeta/90 text-coral'}`}>
                  {quitar.has(f.id) ? '↺' : '✕'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {cupo > 0 && (
        <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-menta bg-seleccion/60 p-4 cursor-pointer active:bg-seleccion">
          <span className="text-2xl">📷</span>
          <span className="flex-1">
            <span className="block font-bold text-bosque">{archivos.length ? `${Math.min(archivos.length, cupo)} foto${archivos.length > 1 ? 's' : ''} lista${archivos.length > 1 ? 's' : ''}` : existente ? 'Agregar más fotos' : 'Agregar fotos'}</span>
            <span className="block text-xs text-salvia">{archivos.length > cupo ? `Solo caben ${cupo} más; subo las primeras` : `Hasta ${cupo}, las comprimo por ti`}</span>
          </span>
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setArchivos(Array.from(e.target.files ?? []))} />
        </label>
      )}
      <button onClick={guardar} disabled={guardando || !titulo || !fecha} className="btn-primary">
        {guardando ? 'Guardando…' : existente ? 'Guardar cambios 💚' : 'Guardar recuerdo 📸'}
      </button>
    </div>
  );
}
