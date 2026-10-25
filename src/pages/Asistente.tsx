// El chat del asistente Payakan: conversaciones que se guardan en asistente_conversaciones y
// asistente_mensajes, con historial aparte del del Ciclo. Las sugerencias (planea esta cita,
// agregar a planes, escribir una carta…) son botones bajo cada respuesta, una sola vez por mensaje.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAvisos } from '../lib/avisos';
import { preguntarAPayakan, type AccionPayakan } from '../lib/payakan';
import Texto from '../components/TextoPayakan';
import HistorialConversaciones, { type ConversacionResumen } from '../components/HistorialConversaciones';
import { MascotaPrimaria } from '../components/MascotaDinamica';
import { ChipsConMas, ColaBallena, IconoAtras, IconoCalendario, IconoCarta, IconoFlecha, IconoLista, IconoMas, IconoPeli, IconoVale } from '../components/ui';

type Accion = AccionPayakan;
type Mensaje = { id: string; rol: 'user' | 'assistant'; contenido: string; acciones: Accion[] };

const ICONO_ACCION = { planear_cita: IconoCalendario, agregar_plan: IconoLista, agregar_peli: IconoPeli, escribir_carta: IconoCarta, regalar_cupon: IconoVale };
const VERBO_ACCION = { planear_cita: 'Planear esta cita', agregar_plan: 'Agregar a Planes', agregar_peli: 'Agregar a Pelis', escribir_carta: 'Escribir la carta', regalar_cupon: 'Regalar este cupón' };

export default function Asistente() {
  const { perfil } = useAuth();
  const { aviso, revisar, confirmar } = useAvisos();
  const navigate = useNavigate();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargado, setCargado] = useState(false);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [pareja, setPareja] = useState('');
  const [hechas, setHechas] = useState<Set<string>>(new Set());
  // Las conversaciones de aquí son aparte de las de Ciclo (esas se guardan cifradas en esa sección)
  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>([]);
  const [actual, setActual] = useState<string | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const pedido = useRef(0);

  const cargarLista = async () => {
    const { data } = await supabase.from('asistente_conversaciones').select('id, titulo, updated_at').order('updated_at', { ascending: false }).limit(100);
    const lista = (data ?? []).map((c) => ({ id: c.id, titulo: c.titulo, actualizada: c.updated_at }));
    setConversaciones(lista);
    return lista;
  };

  const abrir = async (id: string | null) => {
    const n = ++pedido.current;
    setActual(id);
    setHechas(new Set());
    if (!id) { setMensajes([]); setCargado(true); return; }
    const { data } = await supabase.from('asistente_mensajes').select('id, rol, contenido, acciones').eq('conversacion_id', id).order('created_at').limit(200);
    if (n !== pedido.current) return; // ya se abrió otra
    setMensajes((data as Mensaje[]) ?? []);
    setCargado(true);
  };

  useEffect(() => {
    // Abre donde quedó: la conversación más reciente
    cargarLista().then((l) => abrir(l[0]?.id ?? null));
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    supabase.from('configuracion').select('nombre_el, nombre_ella').eq('id', 1).single()
      .then(({ data }) => setPareja((perfil?.rol === 'admin' ? data?.nombre_ella : data?.nombre_el) ?? 'tu amor'));
  }, [perfil?.rol]);

  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [mensajes.length, pensando]);

  const enviar = async (pregunta = texto) => {
    const q = pregunta.trim();
    if (!q || pensando) return;
    setTexto('');
    setMensajes((m) => [...m, { id: `tmp-${Date.now()}`, rol: 'user', contenido: q, acciones: [] }]);
    setPensando(true);
    const decir = (contenido: string) => setMensajes((m) => [...m, { id: `err-${Date.now()}`, rol: 'assistant', contenido, acciones: [] }]);
    const n = pedido.current;
    const r = await preguntarAPayakan({ mensaje: q, conversacion: actual });
    if (n !== pedido.current) { setPensando(false); cargarLista(); return; } // se cambió de conversación mientras pensaba
    if (!r.ok) decir(r.texto);
    else {
      if (r.datos.conversacion) setActual(r.datos.conversacion);
      setMensajes((m) => [...m, { id: r.datos.id ?? `a-${Date.now()}`, rol: 'assistant', contenido: r.datos.texto, acciones: r.datos.acciones ?? [] }]);
      cargarLista();
    }
    setPensando(false);
  };

  const hacer = async (a: Accion, clave: string) => {
    switch (a.tipo) {
      case 'planear_cita': return navigate('/citas', { state: { plan: { titulo: a.titulo, emoji: '✨' } } });
      case 'escribir_carta': return navigate('/cartas', { state: { carta: { titulo: a.titulo, contenido: a.texto ?? '' } } });
      case 'regalar_cupon': return navigate('/juntos?tab=cupones', { state: { cupon: a.titulo } });
      case 'agregar_plan': {
        const { error } = revisar(await supabase.from('suenos').insert({ titulo: a.titulo, emoji: '✨' }), 'No pude agregarlo');
        if (!error) { aviso('Quedó en Planes 💚'); setHechas((s) => new Set(s).add(clave)); }
        return;
      }
      case 'agregar_peli': {
        const { error } = revisar(await supabase.from('pelis').insert({ titulo: a.titulo }), 'No pude agregarla');
        if (!error) { aviso('Quedó en Pelis 🍿'); setHechas((s) => new Set(s).add(clave)); }
        return;
      }
    }
  };

  const borrar = async (id: string) => {
    if (!(await confirmar({ titulo: '¿Borrar esta conversación?', texto: 'Se borra lo que hablamos en ella. Lo que agregaste a la app se queda.', boton: 'Borrar conversación', peligro: true }))) return;
    const { error } = revisar(await supabase.from('asistente_conversaciones').delete().eq('id', id), 'No pude borrarla');
    if (error) return;
    const lista = await cargarLista();
    if (id === actual) abrir(lista[0]?.id ?? null);
  };

  const ideas = [
    'Planéanos una cita para este sábado con 80 mil',
    `¿Qué le puedo regalar a ${pareja || 'mi amor'}?`,
    `Ayúdame a escribirle una carta a ${pareja || 'mi amor'}`,
    'Un plan bonito para un día de lluvia en Bogotá',
    '¿Qué conciertos o eventos hay en Bogotá este mes?',
    '¿Cuál ha sido nuestra mejor cita según lo que guardamos?',
    'Ideas de sorpresa para nuestro mesiversario',
    '¿Qué lugar por conocer nos queda mejor para este finde?',
    'Una peli para ver hoy que nos guste a los dos',
    'Recuérdame algo bonito que hayamos vivido',
  ];

  return (
    <div className="max-w-lg mx-auto min-h-[calc(100dvh-8rem)] flex flex-col">
      <header className="sticky top-0 z-20 bg-crema/90 backdrop-blur px-5 pt-[max(env(safe-area-inset-top),12px)] pb-3 flex items-center gap-3 border-b border-menta/60">
        <Link to="/" className="btn-icon" aria-label="Volver al inicio"><IconoAtras /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-tight">Payakan</h1>
          <p className="text-sm text-salvia leading-tight text-balance">Tu asistente para los dos · con IA</p>
        </div>
        {mensajes.length > 0 && <button onClick={() => abrir(null)} disabled={pensando} className="btn-icon" aria-label="Empezar una conversación nueva"><IconoMas className="w-5 h-5" /></button>}
        <button onClick={() => setVerHistorial(true)} className="btn-icon" aria-label="Ver las conversaciones guardadas"><IconoLista className="w-5 h-5" /></button>
      </header>

      <HistorialConversaciones abierta={verHistorial} onClose={() => setVerHistorial(false)} lista={conversaciones} actual={actual}
        nota="Lo que hablas en Ciclo no aparece aquí: esas conversaciones se guardan aparte y cifradas."
        onAbrir={abrir} onBorrar={borrar} onNueva={() => abrir(null)} />

      <div className="flex-1 px-5 py-4 flex flex-col gap-3" aria-live="polite">
        {cargado && mensajes.length === 0 && (
          <div className="flex flex-col gap-4 items-center text-center pt-4">
            <div className="w-40" aria-hidden="true"><MascotaPrimaria className="w-full" /></div>
            <div>
              <p className="font-titulo text-2xl font-semibold">Hiii, soy Payakan 🐋</p>
              <p className="text-salvia mt-1 max-w-xs mx-auto">Conozco sus recuerdos, sus respuestas y sus lugares por conocer. Pregúntame lo que quieras para los dos.</p>
            </div>
            <div className="w-full text-left">
              <p className="eyebrow mb-2">Puedes empezar con</p>
              <ChipsConMas opciones={ideas} elegida="" onElegir={(o) => o && enviar(o)} visibles={4} etiqueta="Ideas para preguntar" />
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {mensajes.map((m) => m.rol === 'user' ? (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="self-end max-w-[85%] rounded-[1.4rem] rounded-br-md bg-hondo text-white px-4 py-2.5 whitespace-pre-wrap [overflow-wrap:anywhere]">
              {m.contenido}
            </motion.div>
          ) : (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="self-start w-full flex gap-2">
              <span className="w-8 h-8 shrink-0 rounded-full bg-hondo text-lima flex items-center justify-center mt-1" aria-hidden="true"><ColaBallena className="w-4 h-4" /></span>
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="card px-4 py-3 rounded-[1.4rem] rounded-tl-md flex flex-col gap-2 leading-relaxed text-[0.97rem]">
                  <Texto texto={m.contenido} />
                </div>
                {m.acciones?.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {m.acciones.map((a, i) => {
                      const clave = `${m.id}-${i}`;
                      const Icono = ICONO_ACCION[a.tipo] ?? IconoFlecha;
                      const hecha = hechas.has(clave);
                      return (
                        <button key={clave} onClick={() => hacer(a, clave)} disabled={hecha} className="fila-aviso min-h-12 text-left w-full disabled:opacity-60">
                          <Icono className="w-5 h-5 text-bosque shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold leading-tight">{hecha ? 'Listo ✓' : VERBO_ACCION[a.tipo]}: {a.titulo}</span>
                            {a.detalle && <span className="block text-xs text-salvia">{a.detalle}</span>}
                          </span>
                          {!hecha && <IconoFlecha className="w-4 h-4 text-bosque shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {pensando && (
          <div className="self-start flex gap-2 items-center" role="status">
            <span className="w-8 h-8 shrink-0 rounded-full bg-hondo text-lima flex items-center justify-center" aria-hidden="true"><ColaBallena className="w-4 h-4" /></span>
            <span className="card px-4 py-3 rounded-[1.4rem] rounded-tl-md flex gap-1.5 items-center" aria-label="Payakan está pensando">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="w-2 h-2 rounded-full bg-esmeralda" animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </span>
          </div>
        )}
        <div ref={fin} />
      </div>

      {/* Encima de la barra de abajo */}
      <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="sticky bottom-[calc(max(env(safe-area-inset-bottom),14px)+76px)] px-4 pb-2 pt-2">
        <div className="campo-compuesto flex gap-2 items-end rounded-[1.6rem] bg-tarjeta border border-menta shadow-soft p-1.5">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1} maxLength={2000}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder="Pregúntale a Payakan…" aria-label="Escribe tu pregunta"
            className="flex-1 resize-none bg-transparent outline-none px-3 py-2.5 max-h-32 text-bosque-oscuro placeholder:text-[var(--placeholder)]" />
          <button type="submit" disabled={!texto.trim() || pensando} className="w-11 h-11 shrink-0 rounded-full bg-hondo text-white flex items-center justify-center disabled:opacity-40" aria-label="Enviar">
            <IconoFlecha className="w-5 h-5 -rotate-90" />
          </button>
        </div>
      </form>
    </div>
  );
}
