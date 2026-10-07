import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Ballena, { Burbujas } from '../components/Ballena';
import { Encabezado, Segmented, IconoCheck, Vacio } from '../components/ui';
import { useAvisos } from '../lib/avisos';
import { hoyStr } from '../lib/utils';

const POR_PAGINA = 14;

export default function Preguntas() {
  const { perfil } = useAuth();
  const [tab, setTab] = useState<'dia' | 'cartas'>('dia');
  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Encabezado eyebrow="Conocernos un poquito más" titulo="Preguntas 💭" />
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
      <div className="card-hero text-center py-8">
        <p className="eyebrow text-lima">Hoy</p>
        {racha && racha.dias > 0 && (
          <p className="badge bg-white/15 text-white backdrop-blur mt-2 relative">🔥 {racha.dias} {racha.dias === 1 ? 'día' : 'días'} seguidos{racha.hoy_completo ? ' · hoy ya cuenta ✓' : ''}</p>
        )}
        <p className="font-titulo text-2xl font-semibold leading-snug mt-2 relative">{pregunta?.texto ?? '…'}</p>
        <Burbujas className="absolute w-20 left-3 bottom-2 opacity-70" color="#FFFFFF" />
        <Burbujas className="absolute w-16 right-4 top-2 opacity-50" color="#C3E08A" />
      </div>

      {!miRespuesta ? (
        <div className="card p-4 flex flex-col gap-3">
          {estado.pareja && (
            <div className="flex items-center gap-3 rounded-2xl bg-seleccion border border-menta px-3 py-2">
              <Ballena className="w-12 shrink-0" />
              <p className="text-sm font-bold text-bosque">{pareja} ya respondió 💌 Escribe la tuya para ver qué dijo.</p>
            </div>
          )}
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe tu respuesta…" className="input min-h-28" />
          <button onClick={responder} className="btn-primary">Guardar mi respuesta 💚</button>
          {!estado.pareja && <p className="text-xs text-salvia text-center">🔒 Solo verás la respuesta de {pareja} cuando ya hayas escrito la tuya.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <FlipCard titulo="Tu respuesta" texto={miRespuesta.texto} />
          <EditarRespuesta r={miRespuesta} onGuardada={cargar} />
          {suRespuesta ? <FlipCard titulo={`Respuesta de ${pareja}`} texto={suRespuesta.texto} acento /> : (
            <div className="card flex items-center gap-3 border-dashed">
              <Ballena className="w-16 shrink-0" color="#5E8571" panza="#EAF5ED" />
              <p className="text-salvia font-semibold">{pareja} aún no ha respondido ⏳ Te aparecerá aquí apenas lo haga.</p>
            </div>
          )}
        </div>
      )}

      {historial.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-bold mt-3">Días anteriores</h3>
          {historial.map((h) => <HistorialItem key={h.fecha} item={h} perfil={perfil} />)}
          {hayMas && (
            <button onClick={verMas} disabled={cargandoMas} className="btn-soft py-2.5 mt-1">{cargandoMas ? 'Cargando…' : 'Ver días anteriores'}</button>
          )}
        </div>
      )}
    </div>
  );
}

function FlipCard({ titulo, texto, acento = false }: any) {
  const [vuelta, setVuelta] = useState(false);
  return (
    <motion.button onClick={() => setVuelta(!vuelta)} whileTap={{ scale: 0.97 }}
      className={`card text-left border-2 ${acento ? 'border-esmeralda/40 bg-seleccion' : 'border-menta'}`}>
      <p className="eyebrow">{titulo} 💚</p>
      <p className={`font-titulo text-lg mt-1 transition-all duration-300 ${vuelta ? '' : 'blur-sm select-none'}`}>{texto}</p>
      <p className="text-xs font-bold text-bosque mt-2">{vuelta ? 'Toca para ocultar' : 'Toca para revelar ✨'}</p>
    </motion.button>
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
      <button onClick={() => { setTexto(r.texto); setAbierto(true); }} className={`text-xs font-bold text-bosque ${compacto ? 'self-end' : 'self-center'}`}>
        ✏️ Editar mi respuesta
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <textarea autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} className={`input ${compacto ? 'min-h-16 text-sm' : 'min-h-28'}`} />
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
      <button onClick={ver} className="text-left w-full flex items-center gap-3" aria-expanded={open}>
        <span className="shrink-0 w-11 text-center rounded-xl bg-seleccion py-1">
          <span className="block text-[9px] font-extrabold uppercase text-salvia">{d.toLocaleDateString('es-CO', { month: 'short' })}</span>
          <span className="block font-titulo font-bold text-bosque leading-none">{d.getDate()}</span>
        </span>
        <p className="font-bold text-sm flex-1">{item.preguntas?.texto}</p>
        <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-salvia">›</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 flex flex-col gap-2">
              {r.length === 0 && <p className="text-xs text-salvia">Nadie ha respondido aún.</p>}
              {r.map((x) => <p key={x.id} className={`text-sm rounded-2xl px-3 py-2 ${x.usuario_id === perfil?.id ? 'bg-seleccion self-end' : 'bg-espuma/60 self-start'}`}>{x.texto}</p>)}
              {mia && <EditarRespuesta key={mia.texto} r={mia} onGuardada={recargar} compacto />}
              {!mia && (
                <div className="flex gap-2">
                  <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Responder tarde…" className="input py-2 text-sm" />
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
      <p className="eyebrow">Escoge los temas</p>
      <div className="flex flex-wrap gap-2 -mt-2">
        {cats.map((c) => (
          <button key={c.slug} data-active={sel.includes(c.slug)} onClick={() => setSel(sel.includes(c.slug) ? sel.filter((s) => s !== c.slug) : [...sel, c.slug])} className="chip">{c.emoji} {c.nombre}</button>
        ))}
      </div>
      <button onClick={armar} disabled={sel.length === 0} className="btn-primary">Armar mazo 🃏</button>

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
                    <Ballena className="w-24" color="#CFE9E4" panza="#FFFFFF" />
                    Toca para voltear
                  </span>
                )}
              </button>
              <p className={`text-xs font-bold mt-3 ${volteada ? 'text-salvia' : 'text-white/70'}`}>{idx + 1} / {mazo.length} · Desliza para pasar →</p>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
      {hayCarta && volteada && (
        <button onClick={conversada} className="btn-soft">Ya la hablamos ✓</button>
      )}
      {mazo.length > 0 && idx >= mazo.length && <Vacio titulo="¡Mazo terminado! 🎉" texto="Cuántas cosas nuevas sabemos el uno del otro." />}
      <button onClick={reiniciar} className="text-sm text-salvia underline underline-offset-4 self-center">Reiniciar mazo</button>
    </div>
  );
}
