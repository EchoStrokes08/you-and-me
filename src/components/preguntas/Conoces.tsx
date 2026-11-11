// "¿Qué tan bien me conoces?": adivinar lo que el otro respondió en preguntas del día pasadas,
// calificar lo que el otro adivinó de las mías y el marcador de los dos. Todo pasa por las funciones
// de la 041 (siguiente_adivinanza, adivinar, calificar_adivinanza…); aquí no se lee la tabla directo.
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAvisos } from '../../lib/avisos';
import { Esqueleto, Vacio, IconoAdelante } from '../ui';

type Turno = { respuesta_id: string; pregunta: string; emoji: string | null; categoria: string | null; respondida: string; quedan: number };
type Revelada = { respuesta: string; mi_respuesta: string; adivinanza: string };
type PorCalificar = { id: string; pregunta: string; adivinanza: string; mi_respuesta: string };
type Mia = { id: string; pregunta: string; adivinanza: string; respuesta: string; veredicto: Veredicto | null };
type Marcador = { usuario_id: string; jugadas: number; calificadas: number; puntos: number; exactas: number };
type Veredicto = 'exacto' | 'casi' | 'no';

const VEREDICTOS: { v: Veredicto; emoji: string; etiqueta: string }[] = [
  { v: 'exacto', emoji: '🎯', etiqueta: 'Le atinó' },
  { v: 'casi', emoji: '🤏', etiqueta: 'Casi' },
  { v: 'no', emoji: '🙈', etiqueta: 'Nada que ver' },
];
const PUNTOS: Record<Veredicto, number> = { exacto: 2, casi: 1, no: 0 };

export function Conoces({ yo, pareja }: { yo: string; pareja: string }) {
  const [marcador, setMarcador] = useState<Marcador[] | null>(null);
  const [porCalificar, setPorCalificar] = useState<PorCalificar[]>([]);
  const [mias, setMias] = useState<Mia[]>([]);

  const cargar = useCallback(async () => {
    const [{ data: m }, { data: p }, { data: h }] = await Promise.all([
      supabase.rpc('marcador_adivinanzas'),
      supabase.rpc('adivinanzas_por_calificar'),
      supabase.rpc('mis_adivinanzas', { p_limite: 20 }),
    ]);
    setMarcador(m ?? []);
    setPorCalificar(p ?? []);
    setMias((h ?? []) as Mia[]);
  }, []);

  useEffect(() => {
    cargar();
    // Cuando el otro adivina o califica, se actualiza solo
    const ch = supabase.channel('adivinanzas-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'adivinanzas' }, () => cargar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  return (
    <div className="flex flex-col gap-4">
      <MarcadorCard marcador={marcador} yo={yo} pareja={pareja} />
      {porCalificar.length > 0 && <Calificar items={porCalificar} pareja={pareja} onCambio={cargar} />}
      <Juego pareja={pareja} onJugada={cargar} />
      {mias.length > 0 && <MisAdivinanzas items={mias} pareja={pareja} />}
    </div>
  );
}

function MarcadorCard({ marcador, yo, pareja }: { marcador: Marcador[] | null; yo: string; pareja: string }) {
  if (!marcador) return <Esqueleto className="h-28" />;
  const mio = marcador.find((m) => m.usuario_id === yo);
  const suyo = marcador.find((m) => m.usuario_id !== yo);
  const fila = (nombre: string, m?: Marcador) => {
    const pct = m?.calificadas ? Math.round((100 * m.puntos) / (2 * m.calificadas)) : null;
    return (
      <div className="flex-1 min-w-0 text-center">
        <p className="text-sm font-bold text-salvia truncate">{nombre}</p>
        <p className="font-titulo text-3xl font-semibold leading-none mt-1">{m?.puntos ?? 0}</p>
        <p className="text-xs text-salvia mt-1">{pct === null ? 'sin calificar aún' : `${pct}% de acierto`}</p>
      </div>
    );
  };
  const a = mio?.puntos ?? 0, b = suyo?.puntos ?? 0;
  const frase = !mio?.calificadas && !suyo?.calificadas ? 'Adivina qué respondió y que te califique'
    : a === b ? 'Van empatados 💚' : a > b ? `Tú conoces más a ${pareja}… por ahora` : `${pareja} te conoce más… por ahora`;
  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="eyebrow">¿Quién conoce más a quién?</p>
      <div className="flex items-center gap-2">
        {fila('Tú', mio)}
        <span className="text-salvia font-bold" aria-hidden="true">vs</span>
        {fila(pareja, suyo)}
      </div>
      <p className="text-sm text-center font-semibold">{frase}</p>
    </div>
  );
}

function Juego({ pareja, onJugada }: { pareja: string; onJugada: () => void }) {
  const { revisar } = useAvisos();
  const sinMovimiento = useReducedMotion();
  const [turno, setTurno] = useState<Turno | null>(null);
  const [cargando, setCargando] = useState(true);
  const [saltadas, setSaltadas] = useState<string[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [revelada, setRevelada] = useState<Revelada | null>(null);

  const siguiente = useCallback(async (saltar: string[]) => {
    setCargando(true);
    const { data } = await supabase.rpc('siguiente_adivinanza', { p_saltar: saltar });
    setTurno(data?.[0] ?? null);
    setTexto('');
    setRevelada(null);
    setCargando(false);
  }, []);
  useEffect(() => { siguiente([]); }, [siguiente]);

  const saltar = () => {
    if (!turno) return;
    const s = [...saltadas, turno.respuesta_id];
    setSaltadas(s);
    siguiente(s);
  };

  const adivinar = async () => {
    if (!turno || !texto.trim()) return;
    setEnviando(true);
    const { data, error } = await supabase.rpc('adivinar', { p_respuesta: turno.respuesta_id, p_texto: texto.trim() });
    setEnviando(false);
    revisar({ error }, 'No pude guardar tu adivinanza');
    if (error || !data?.[0]) return;
    setRevelada({ respuesta: data[0].respuesta, mi_respuesta: data[0].mi_respuesta, adivinanza: texto.trim() });
    onJugada();
  };

  if (cargando) return <Esqueleto className="h-56" />;
  if (!turno) {
    return (
      <div className="card p-4">
        <Vacio
          titulo={saltadas.length ? 'Saltaste todas las que quedaban' : 'No quedan preguntas por adivinar'}
          texto={saltadas.length ? 'Vuelve a empezar para ver las que saltaste.' : 'Entran las preguntas del día que los dos respondieron hace más de 3 días. Mañana habrá más.'}>
          {saltadas.length > 0 && <button onClick={() => { setSaltadas([]); siguiente([]); }} className="btn-soft py-2.5 px-5 mt-3">Volver a empezar</button>}
        </Vacio>
      </div>
    );
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{turno.emoji} {turno.categoria ?? 'Pregunta'}</p>
        <p className="text-xs text-salvia">{turno.quedan === 1 ? 'Queda 1' : `Quedan ${turno.quedan}`}</p>
      </div>
      <p className="font-titulo text-xl font-semibold leading-snug">{turno.pregunta}</p>

      <AnimatePresence mode="wait" initial={false}>
        {!revelada ? (
          <motion.div key="adivinar" exit={sinMovimiento ? { opacity: 0 } : { opacity: 0, y: -8 }} className="flex flex-col gap-3">
            <label className="text-sm font-bold text-bosque-oscuro">¿Qué crees que respondió {pareja}?
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} className="input mt-1 min-h-24" placeholder="Escribe lo que crees que dijo…" />
            </label>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button onClick={saltar} className="btn-soft py-2.5 px-4">Saltar</button>
              <button onClick={adivinar} disabled={!texto.trim() || enviando} className="btn-primary py-2.5">{enviando ? 'Revelando…' : 'Adivinar'}</button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="revelada" initial={sinMovimiento ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col gap-3">
            <div className="rounded-2xl bg-seleccion p-3">
              <p className="text-sm font-bold text-salvia">{pareja} respondió</p>
              <p className="font-titulo text-lg leading-snug mt-0.5 whitespace-pre-wrap">{revelada.respuesta}</p>
            </div>
            <div className="rounded-2xl border border-menta p-3">
              <p className="text-sm font-bold text-salvia">Tú adivinaste</p>
              <p className="leading-snug mt-0.5 whitespace-pre-wrap">{revelada.adivinanza}</p>
            </div>
            <p className="text-sm text-salvia">Ese día tú respondiste: <span className="italic">{revelada.mi_respuesta}</span></p>
            <p className="text-sm font-semibold">{pareja} va a decir si le atinaste 🔮</p>
            <button onClick={() => siguiente(saltadas)} className="btn-primary py-2.5 flex items-center justify-center gap-2">Siguiente <IconoAdelante className="w-5 h-5" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Calificar({ items, pareja, onCambio }: { items: PorCalificar[]; pareja: string; onCambio: () => void }) {
  const { revisar } = useAvisos();
  const [guardando, setGuardando] = useState<string | null>(null);
  const calificar = async (id: string, v: Veredicto) => {
    setGuardando(id);
    revisar(await supabase.rpc('calificar_adivinanza', { p_id: id, p_veredicto: v }), 'No pude guardar la calificación');
    setGuardando(null);
    onCambio();
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="eyebrow">{pareja} intentó adivinar · {items.length === 1 ? '1 por calificar' : `${items.length} por calificar`}</p>
      {items.map((it) => (
        <div key={it.id} className="card p-4 flex flex-col gap-2">
          <p className="font-semibold leading-snug">{it.pregunta}</p>
          <p className="text-sm"><span className="font-bold text-salvia">Tú dijiste: </span>{it.mi_respuesta}</p>
          <p className="text-sm"><span className="font-bold text-salvia">{pareja} adivinó: </span>{it.adivinanza}</p>
          <div className="grid grid-cols-3 gap-2 mt-1" role="group" aria-label="¿Qué tanto le atinó?">
            {VEREDICTOS.map(({ v, emoji, etiqueta }) => (
              <button key={v} onClick={() => calificar(it.id, v)} disabled={guardando === it.id} className="btn-soft py-2 px-1 text-sm flex flex-col items-center gap-0.5 min-h-14">
                <span className="text-lg" aria-hidden="true">{emoji}</span>{etiqueta}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MisAdivinanzas({ items, pareja }: { items: Mia[]; pareja: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="text-left font-bold text-bosque min-h-11">
        {abierto ? 'Ocultar' : 'Ver'} tus últimas adivinanzas ({items.length})
      </button>
      {abierto && items.map((it) => {
        const v = VEREDICTOS.find((x) => x.v === it.veredicto);
        return (
          <div key={it.id} className="card p-3 rounded-2xl flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <p className="font-semibold leading-snug flex-1">{it.pregunta}</p>
              <span className="text-sm font-bold shrink-0 text-salvia">{v ? `${v.emoji} +${PUNTOS[v.v]}` : '⏳'}</span>
            </div>
            <p className="text-sm"><span className="font-bold text-salvia">Adivinaste: </span>{it.adivinanza}</p>
            <p className="text-sm"><span className="font-bold text-salvia">{pareja}: </span>{it.respuesta}</p>
            {!v && <p className="text-xs text-salvia">Esperando a que {pareja} la califique</p>}
          </div>
        );
      })}
    </div>
  );
}
