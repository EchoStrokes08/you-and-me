import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Ballena, { Mar } from '../components/Ballena';
import { Encabezado, Segmented, IconoAdelante, IconoCandado, IconoCheck, IconoFuego, IconoLapiz, ColaBallena, Vacio } from '../components/ui';
import { useAvisos } from '../lib/avisos';
import { hoyStr } from '../lib/utils';

const POR_PAGINA = 14;

export default function Preguntas() {
  const { perfil } = useAuth();
  const [tab, setTab] = useState<'dia' | 'cartas'>('dia');
  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Encabezado eyebrow="Conocernos un poquito más" titulo="Preguntas" />
      <Segmented id="tabs-preguntas" value={tab} onChange={setTab} options={[['dia', 'Pregunta del día'], ['cartas', 'Modo cartas']] as const} />
      {tab === 'dia' ? <PreguntaDia perfil={perfil} /> : <Cartas />}
    </div>
  );
}

function PreguntaDia({ perfil }: any) {
  const { revisar } = useAvisos();
  const [pregunta, setPregunta] = useState<any>(null);
  const [respuestas, setRespuestas] = useState<any[]>([]);
  const [estado, setEstado] = useState<{ yo: boolean; pareja: boolean }>({ yo: false, pareja: false });
  const [config, setConfig] = useState<any>(null);
  const [texto, setTexto] = useState('');
  const [historial, setHistorial] = useState<any[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  // Cuántos días anteriores se muestran; en un ref para que Realtime recargue los mismos
  const cantidad = useRef(POR_PAGINA);
  const [racha, setRacha] = useState<{ dias: number; hoy_completo: boolean } | null>(null);

  const cargar = async () => {
    supabase.rpc('racha_preguntas').then(({ data }) => setRacha(data?.[0] ?? null));
    const { data } = await supabase.rpc('obtener_pregunta_del_dia');
    setPregunta(data);
    if (data?.id) {
      const [{ data: r }, { data: e }] = await Promise.all([
        supabase.rpc('obtener_respuestas', { p_pregunta_id: data.id }),
        supabase.rpc('estado_respuestas', { p_pregunta_id: data.id }),
      ]);
      setRespuestas(r ?? []);
      if (e?.[0]) setEstado(e[0]);
    }
    await cargarHistorial();
  };

  // Pide uno de más para saber si quedan días por mostrar
  const cargarHistorial = async () => {
    const n = cantidad.current;
    const { data: hist } = await supabase.from('pregunta_del_dia').select('fecha, preguntas(texto,id)')
      .lt('fecha', hoyStr()).order('fecha', { ascending: false }).range(0, n);
    setHistorial((hist ?? []).slice(0, n));
    setHayMas((hist?.length ?? 0) > n);
  };

  const verMas = async () => {
    setCargandoMas(true);
    cantidad.current += POR_PAGINA;
    await cargarHistorial();
    setCargandoMas(false);
  };
  useEffect(() => {
    cargar();
    supabase.from('configuracion').select('nombre_ella, nombre_el').eq('id', 1).single().then(({ data }) => setConfig(data));
    // Cuando el otro responde (o vuelves a la app) se actualiza solo
    const ch = supabase.channel('respuestas-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'respuestas' }, () => cargar()).subscribe();
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { supabase.removeChannel(ch); document.removeEventListener('visibilitychange', alVolver); };
  }, []);

  const responder = async () => {
    if (!texto.trim() || !perfil) return;
    const { error } = revisar(await supabase.from('respuestas').insert({ pregunta_id: pregunta.id, usuario_id: perfil.id, texto: texto.trim() }), 'No pude guardar tu respuesta');
    if (error) return;
    setTexto('');
    cargar();
  };

  const miRespuesta = respuestas.find((r) => r.usuario_id === perfil?.id);
  const suRespuesta = respuestas.find((r) => r.usuario_id !== perfil?.id);
  const pareja = (perfil?.rol === 'admin' ? config?.nombre_ella : config?.nombre_el) ?? (perfil?.rol === 'admin' ? 'Ella' : 'Él');

  return (
    <div className="flex flex-col gap-4 stagger">
      <Mar className="py-7">
        {pregunta ? (
          <h2 className="relative text-[1.75rem] font-semibold leading-[1.15]">{pregunta.texto}</h2>
        ) : (
          <div className="relative flex flex-col gap-2" aria-label="Cargando la pregunta de hoy"><div className="esqueleto h-7 w-11/12 opacity-40" /><div className="esqueleto h-7 w-2/3 opacity-40" /></div>
        )}
        <p className="relative text-sm font-bold mt-3 flex items-center gap-1.5">
          {racha && racha.dias > 0 ? <><IconoFuego className="w-4 h-4 text-lima" /> {racha.dias} {racha.dias === 1 ? 'día seguido' : 'días seguidos'}{racha.hoy_completo ? ', y hoy ya cuenta' : ''}</> : 'La pregunta de hoy'}
        </p>
      </Mar>

      {!miRespuesta ? (
        <div className="card p-4 flex flex-col gap-3">
          {estado.pareja && (
            <div className="flex items-center gap-3 rounded-2xl bg-seleccion border border-menta px-3 py-2">
              <Ballena className="w-12 shrink-0" />
              <p className="text-sm font-bold text-bosque">{pareja} ya respondió. Escribe la tuya para ver qué dijo.</p>
            </div>
          )}
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe tu respuesta…" aria-label="Tu respuesta" className="input min-h-28" />
          <button onClick={responder} className="btn-primary">Guardar mi respuesta</button>
          {!estado.pareja && <p className="text-sm text-salvia flex items-start gap-2"><IconoCandado className="w-4 h-4 shrink-0 mt-0.5" /> Solo verás la respuesta de {pareja} cuando ya hayas escrito la tuya.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="card">
            <p className="text-sm font-bold text-salvia">Tu respuesta</p>
            <p className="font-titulo text-xl leading-snug mt-1 whitespace-pre-wrap">{miRespuesta.texto}</p>
            <EditarRespuesta r={miRespuesta} onGuardada={cargar} />
          </div>
          {suRespuesta ? <Revelacion key={suRespuesta.id} id={suRespuesta.id} pareja={pareja} texto={suRespuesta.texto} /> : (
            <div className="card flex items-center gap-3 border-dashed">
              <Ballena className="w-16 shrink-0" />
              <p className="text-salvia font-semibold">{pareja} aún no ha respondido. Te aparecerá aquí apenas lo haga.</p>
            </div>
          )}
        </div>
      )}

      {historial.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold mt-4">Días anteriores</h2>
          {historial.map((h) => <HistorialItem key={h.fecha} item={h} perfil={perfil} />)}
          {hayMas && (
            <button onClick={verMas} disabled={cargandoMas} className="btn-soft py-2.5 mt-1">{cargandoMas ? 'Cargando…' : 'Ver días anteriores'}</button>
          )}
        </div>
      )}
    </div>
  );
}

// La respuesta del otro llega tapada por una ola: se toca una vez y el mar se retira.
// En este celular queda destapada para las siguientes visitas.
function Revelacion({ id, pareja, texto }: { id: string; pareja: string; texto: string }) {
  const sinMovimiento = useReducedMotion();
  const clave = `respuesta-vista-${id}`;
  const [vista, setVista] = useState(() => { try { return localStorage.getItem(clave) === '1'; } catch { return false; } });
  const [recien, setRecien] = useState(false);
  const destapar = () => {
    setVista(true); setRecien(true);
    try { localStorage.setItem(clave, '1'); } catch { /* sin almacenamiento */ }
  };
  return (
    <div className="card relative overflow-hidden bg-seleccion min-h-36">
      <p className="text-sm font-bold text-salvia">Respuesta de {pareja}</p>
      {vista && (
        <motion.p initial={recien && !sinMovimiento ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="font-titulo text-xl leading-snug mt-1 whitespace-pre-wrap">{texto}</motion.p>
      )}
      <AnimatePresence>
        {!vista && (
          <motion.button onClick={destapar} exit={sinMovimiento ? { opacity: 0 } : { y: '-115%' }} transition={{ duration: sinMovimiento ? 0.01 : 0.8, ease: [0.7, 0, 0.3, 1] }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
            <span className="absolute inset-0 bg-[linear-gradient(180deg,var(--mar-1),var(--mar-2))]" />
            {/* El borde de la ola que se va */}
            <svg viewBox="0 0 400 24" preserveAspectRatio="none" className="absolute top-full left-0 w-full h-5 -mt-px" aria-hidden="true"><path d="M0 0h400v6c-34 14-66 14-100 4s-66-10-100 4S134 24 100 12 34 0 0 12Z" fill="var(--mar-2)" /></svg>
            <span className="relative w-12 h-12 rounded-full bg-white/15 flex items-center justify-center"><ColaBallena className="w-7 h-7 text-lima" /></span>
            <span className="relative font-titulo text-xl font-semibold">{pareja} ya respondió</span>
            <span className="relative text-sm font-bold">Toca para ver qué dijo</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// "Editar mi respuesta": por si se envió a medias o con un error
function EditarRespuesta({ r, onGuardada, compacto = false }: { r: any; onGuardada: () => void; compacto?: boolean }) {
  const { revisar, aviso } = useAvisos();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState(r.texto);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!texto.trim()) return;
    setGuardando(true);
    const { error } = revisar(await supabase.from('respuestas').update({ texto: texto.trim() }).eq('id', r.id), 'No pude guardar el cambio');
    setGuardando(false);
    if (error) return;
    setAbierto(false);
    aviso('Respuesta actualizada 💚');
    onGuardada();
  };

  if (!abierto) {
    return (
      <button onClick={() => { setTexto(r.texto); setAbierto(true); }} className={`min-h-11 text-sm font-bold text-bosque flex items-center gap-1.5 ${compacto ? 'self-end' : '-mb-3'}`}>
        <IconoLapiz className="w-4 h-4" /> Editar mi respuesta
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 mt-2">
      <textarea autoFocus aria-label="Editar tu respuesta" value={texto} onChange={(e) => setTexto(e.target.value)} className={`input ${compacto ? 'min-h-16 text-sm' : 'min-h-28'}`} />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setAbierto(false)} className="btn-soft py-2">Volver</button>
        <button onClick={guardar} disabled={!texto.trim() || guardando} className="btn-primary py-2">{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  );
}

function HistorialItem({ item, perfil }: any) {
  const { revisar } = useAvisos();
  const [open, setOpen] = useState(false);
  const [r, setR] = useState<any[]>([]);
  const [texto, setTexto] = useState('');
  const recargar = async () => {
    const { data } = await supabase.rpc('obtener_respuestas', { p_pregunta_id: item.preguntas.id });
    setR(data ?? []);
  };
  const ver = async () => {
    setOpen(!open);
    recargar();
  };
  const responder = async () => {
    if (!texto.trim()) return;
    const { error } = revisar(await supabase.from('respuestas').insert({ pregunta_id: item.preguntas.id, usuario_id: perfil.id, texto: texto.trim() }), 'No pude guardar tu respuesta');
    if (error) return;
    setTexto('');
    recargar();
  };
  const mia = r.find((x) => x.usuario_id === perfil?.id);
  const d = new Date(item.fecha + 'T00:00:00');
  return (
    <div className="card p-3">
      <button onClick={ver} className="text-left w-full min-h-12 flex items-center gap-3" aria-expanded={open}>
        <span className="shrink-0 w-12 text-center rounded-xl bg-seleccion py-1.5">
          <span className="block text-xs font-extrabold uppercase text-salvia leading-tight">{d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')}</span>
          <span className="block font-titulo text-lg font-bold text-bosque leading-none">{d.getDate()}</span>
        </span>
        <p className="font-bold flex-1">{item.preguntas?.texto}</p>
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-salvia"><IconoAdelante className="w-4 h-4" /></motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 flex flex-col gap-2">
              {r.length === 0 && <p className="text-sm text-salvia">Nadie ha respondido aún.</p>}
              {r.map((x) => <p key={x.id} className={`text-sm rounded-2xl px-3 py-2 ${x.usuario_id === perfil?.id ? 'bg-seleccion self-end' : 'bg-espuma/60 self-start'}`}>{x.texto}</p>)}
              {mia && <EditarRespuesta key={mia.texto} r={mia} onGuardada={recargar} compacto />}
              {!mia && (
                <div className="flex gap-2">
                  <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Responder tarde…" aria-label="Responder tarde" className="input py-2" />
                  <button onClick={responder} className="btn-primary px-3 py-2" aria-label="Enviar"><IconoCheck /></button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Cartas() {
  const { revisar, confirmar } = useAvisos();
  const [cats, setCats] = useState<any[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [mazo, setMazo] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [volteada, setVolteada] = useState(false);
  const [conversadas, setConversadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.from('categorias_preguntas').select('*').eq('activo', true).order('orden').then(({ data }) => setCats(data ?? []));
    supabase.from('preguntas_conversadas').select('pregunta_id').then(({ data }) => setConversadas(new Set((data ?? []).map((d) => d.pregunta_id))));
  }, []);

  const armar = async () => {
    if (sel.length === 0) return;
    const { data } = await supabase.from('preguntas').select('*').in('categoria_slug', sel).eq('activo', true);
    const m = (data ?? []).filter((p) => !conversadas.has(p.id)).sort(() => Math.random() - 0.5);
    setMazo(m); setIdx(0); setVolteada(false);
  };

  const conversada = async () => {
    const p = mazo[idx];
    const { error } = revisar(await supabase.from('preguntas_conversadas').insert({ pregunta_id: p.id }), 'No pude marcarla');
    if (error) return;
    setConversadas(new Set([...conversadas, p.id]));
    setIdx(idx + 1); setVolteada(false);
  };

  const reiniciar = async () => {
    if (!(await confirmar({ titulo: '¿Reiniciar el mazo?', texto: 'Las preguntas que ya hablaron volverán a salir.', boton: 'Reiniciar' }))) return;
    const { error } = revisar(await supabase.from('preguntas_conversadas').delete().neq('pregunta_id', '00000000-0000-0000-0000-000000000000'), 'No pude reiniciar el mazo');
    if (!error) setConversadas(new Set());
  };

  const hayCarta = mazo.length > 0 && idx < mazo.length;

  return (
    <div className="flex flex-col gap-4">
      <p className="font-bold">Escoge los temas</p>
      <div className="flex flex-wrap gap-2 -mt-2">
        {cats.map((c) => (
          <button key={c.slug} data-active={sel.includes(c.slug)} onClick={() => setSel(sel.includes(c.slug) ? sel.filter((s) => s !== c.slug) : [...sel, c.slug])} className="chip">{c.emoji} {c.nombre}</button>
        ))}
      </div>
      <button onClick={armar} disabled={sel.length === 0} className="btn-primary">Armar mazo</button>

      {hayCarta && (
        <div className="relative h-64 mt-2">
          {/* cartas de fondo para dar sensación de mazo */}
          {idx + 2 < mazo.length && <div className="absolute inset-x-6 top-4 bottom-0 rounded-[1.75rem] bg-menta rotate-[-3deg]" />}
          {idx + 1 < mazo.length && <div className="absolute inset-x-3 top-2 bottom-1 rounded-[1.75rem] bg-espuma rotate-[2deg]" />}
          <AnimatePresence mode="popLayout">
            <motion.div key={mazo[idx].id}
              drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7}
              onDragEnd={(_, info) => { if (info.offset.x > 100) { setIdx(idx + 1); setVolteada(false); } }}
              initial={{ scale: 0.92, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ x: 320, rotate: 14, opacity: 0 }}
              whileDrag={{ rotate: 6, scale: 1.02 }}
              className={`absolute inset-0 rounded-[1.75rem] p-7 text-center flex flex-col justify-center cursor-grab active:cursor-grabbing ${volteada ? 'card' : 'card-hero'}`}>
              <button onClick={() => setVolteada(!volteada)} className="font-titulo text-2xl font-semibold leading-snug">
                {volteada ? mazo[idx].texto : (
                  <span className="flex flex-col items-center gap-2">
                    <Ballena className="w-28" />
                    Toca para voltear
                  </span>
                )}
              </button>
              <p className={`text-sm font-bold mt-3 ${volteada ? 'text-salvia' : 'text-white'}`}>{idx + 1} / {mazo.length} · Desliza para pasar →</p>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
      {hayCarta && volteada && (
        <button onClick={conversada} className="btn-soft"><IconoCheck className="w-4 h-4" /> Ya la hablamos</button>
      )}
      {mazo.length > 0 && idx >= mazo.length && <Vacio titulo="¡Mazo terminado!" texto="Cuántas cosas nuevas sabemos el uno del otro." />}
      <button onClick={reiniciar} className="min-h-11 px-3 text-sm text-salvia underline underline-offset-4 self-center">Reiniciar mazo</button>
    </div>
  );
}
