// Sección "Aprender" del ciclo: explicaciones cortas de salud menstrual y, para lo que no esté, Payakan con su historial de charlas.
// Sirve para quien lleva el ciclo y para la pareja: según quién entra, los temas y preguntas sugeridas cambian.
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Charla, Fase } from '../../lib/ciclo/tipos';
import { TEMAS } from '../../lib/ciclo/educacion';
import { preguntarAPayakan } from '../../lib/payakan';
import { useAvisos } from '../../lib/avisos';
import { ColaBallena, IconoAdelante, IconoFlecha, IconoLista } from '../ui';
import TextoPayakan from '../TextoPayakan';
import HistorialConversaciones from '../HistorialConversaciones';

type Turno = Charla['turnos'][number];
const tituloDe = (q: string) => { const l = q.replace(/\s+/g, ' ').trim(); return l.length > 60 ? `${l.slice(0, 57).trimEnd()}…` : l; };

const EN_FASE: Record<Fase, string> = {
  menstrual: 'con el periodo',
  folicular: 'en la fase folicular',
  ovulatoria: 'a mitad del ciclo',
  lutea: 'en la fase lútea',
  premenstrual: 'en los días antes del periodo',
  hormonal: 'con anticonceptivo hormonal',
};

// Lo que conviene preguntar según quién lee y en qué fase va el ciclo (si se sabe)
function ideas(paraPareja: boolean, pareja: string, fase?: Fase): string[] {
  if (paraPareja) return [
    ...(fase ? [`${pareja} está ${EN_FASE[fase]}, ¿cómo la puedo acompañar?`] : []),
    `¿Qué le puedo decir a ${pareja} cuando tiene cólicos?`,
    'Ideas de detalles para sus días de periodo',
    '¿Qué es el SPM y cómo se nota?',
    '¿Por qué cambia el ánimo durante el ciclo?',
  ];
  return [
    ...(fase ? [`Estoy ${EN_FASE[fase]}, ¿qué me puede ayudar a sentirme mejor?`] : []),
    '¿Qué puedo comer o hacer para los cólicos?',
    '¿Es normal que mi ciclo cambie de un mes a otro?',
    '¿Qué ejercicio me sienta mejor en cada fase?',
    '¿Cómo sé si mi flujo es normal?',
  ];
}

// Explicaciones cortas; quien recibe ve primero cómo acompañar. Arriba, Payakan para lo que no esté aquí
export default function Aprender({ paraPareja, pareja = '', fase, charlas, onGuardar, onBorrar }: {
  paraPareja?: boolean; pareja?: string; fase?: Fase;
  charlas: Charla[]; onGuardar: (ch: Charla) => Promise<void>; onBorrar: (id: string) => Promise<void>;
}) {
  const { confirmar, aviso } = useAvisos();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [actual, setActual] = useState<Charla | null>(null);
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  const caja = useRef<HTMLElement>(null);
  const turnos: Turno[] = actual?.turnos ?? [];
  const orden = paraPareja ? ['acompanar', 'fases', 'spm', 'dismenorrea', 'fertil', 'irregular'] : ['fases', 'spm', 'dismenorrea', 'irregular', 'fertil', 'acompanar'];
  const temas = orden.map((id) => TEMAS.find((t) => t.id === id)!).filter(Boolean);

  // Estas conversaciones no van al chat de Payakan: se guardan cifradas con la llave del ciclo
  const preguntar = async (pregunta = texto) => {
    const q = pregunta.trim();
    if (!q || pensando) return;
    const ahora = new Date().toISOString();
    const base: Charla = actual ?? { id: crypto.randomUUID(), titulo: tituloDe(q), creada: ahora, actualizada: ahora, turnos: [] };
    const antes = base.turnos;
    setTexto('');
    setError('');
    setActual({ ...base, turnos: [...antes, { rol: 'user', contenido: q }] });
    setPensando(true);
    caja.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const r = await preguntarAPayakan({ mensaje: q, modo: 'ciclo', historia: antes });
    setPensando(false);
    if (!r.ok) {
      // La pregunta vuelve a la caja para intentarlo otra vez; lo que falló no se guarda
      setActual(antes.length ? base : null);
      setTexto(q);
      setError(r.texto);
      return;
    }
    const lista: Charla = { ...base, actualizada: new Date().toISOString(), turnos: [...antes, { rol: 'user', contenido: q }, { rol: 'assistant', contenido: r.datos.texto }] };
    setActual(lista);
    onGuardar(lista).catch(() => aviso('No pude guardar esta conversación', 'error'));
  };

  const borrar = async (id: string) => {
    if (!(await confirmar({ titulo: '¿Borrar esta conversación?', texto: 'Se borra de este historial y no se puede recuperar.', boton: 'Borrar conversación', peligro: true }))) return;
    try {
      await onBorrar(id);
      if (actual?.id === id) setActual(null);
    } catch { aviso('No pude borrarla', 'error'); }
  };

  const nueva = () => { setActual(null); setError(''); };

  return (
    <div className="flex flex-col gap-3">
      <section ref={caja} className="card flex flex-col gap-3 scroll-mt-4" aria-labelledby="payakan-ciclo">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 shrink-0 rounded-full bg-hondo text-lima flex items-center justify-center" aria-hidden="true"><ColaBallena className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="payakan-ciclo" className="font-titulo text-lg font-semibold leading-tight">Pregúntale a Payakan</h2>
            <p className="text-xs text-salvia">No ve tus registros: solo le llega lo que escribas aquí. Estas conversaciones van aparte del chat de Payakan y se guardan cifradas.</p>
          </div>
          <button type="button" onClick={() => setVerHistorial(true)} className="btn-icon shrink-0" aria-label={`Ver las conversaciones guardadas del ciclo (${charlas.length})`}>
            <IconoLista className="w-5 h-5" />
          </button>
        </div>

        <HistorialConversaciones abierta={verHistorial} onClose={() => setVerHistorial(false)} titulo="Conversaciones del ciclo"
          nota="Solo se abren con tu llave del ciclo: ni la base ni Payakan pueden leerlas después. No aparecen en el chat de Payakan."
          lista={charlas.map((c) => ({ id: c.id, titulo: c.titulo, actualizada: c.actualizada }))} actual={actual?.id ?? null}
          onAbrir={(id) => { const c = charlas.find((x) => x.id === id); if (c) { setActual(c); setError(''); } }} onBorrar={borrar} onNueva={nueva} />

        {turnos.length === 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Ideas para preguntar">
            {ideas(!!paraPareja, pareja || 'ella', fase).slice(0, 4).map((i) => (
              <button key={i} type="button" className="chip text-sm text-left" onClick={() => preguntar(i)}>{i}</button>
            ))}
          </div>
        )}

        {turnos.length > 0 && (
          <div className="flex flex-col gap-2.5" aria-live="polite">
            <AnimatePresence initial={false}>
              {turnos.map((m, i) => m.rol === 'user' ? (
                <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="self-end max-w-[85%] rounded-[1.2rem] rounded-br-md bg-hondo text-white px-3.5 py-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{m.contenido}</motion.p>
              ) : (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="self-start w-full rounded-[1.2rem] rounded-tl-md bg-seleccion px-3.5 py-2.5 text-[0.95rem] leading-relaxed flex flex-col gap-2">
                  <TextoPayakan texto={m.contenido} />
                </motion.div>
              ))}
            </AnimatePresence>
            {pensando && (
              <span className="self-start rounded-[1.2rem] rounded-tl-md bg-seleccion px-3.5 py-3 flex gap-1.5" role="status" aria-label="Payakan está pensando">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="w-2 h-2 rounded-full bg-esmeralda" animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </span>
            )}
          </div>
        )}

        {error && <p className="text-sm text-coral" role="alert">{error}</p>}

        <form onSubmit={(e) => { e.preventDefault(); preguntar(); }} className="campo-compuesto flex gap-2 items-end rounded-[1.6rem] bg-tarjeta border border-menta p-1.5">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={1} maxLength={1000}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); preguntar(); } }}
            placeholder={paraPareja ? '¿Cómo la acompaño…?' : 'Pregunta del ciclo…'} aria-label="Escribe tu pregunta para Payakan"
            className="flex-1 resize-none bg-transparent outline-none px-3 py-2.5 max-h-32 text-bosque-oscuro placeholder:text-[var(--placeholder)]" />
          <button type="submit" disabled={!texto.trim() || pensando} className="w-11 h-11 shrink-0 rounded-full bg-hondo text-white flex items-center justify-center disabled:opacity-40" aria-label="Preguntar">
            <IconoFlecha className="w-5 h-5 -rotate-90" />
          </button>
        </form>
        {turnos.length > 0 && !pensando && (
          <button type="button" className="text-sm font-bold text-bosque self-start min-h-11" onClick={nueva}>Empezar otra conversación</button>
        )}
      </section>

      {temas.map((t) => {
        const abiertoAqui = abierto === t.id;
        return (
          <section key={t.id} className="card !p-0 overflow-hidden">
            <button onClick={() => setAbierto(abiertoAqui ? null : t.id)} aria-expanded={abiertoAqui} className="w-full flex items-center gap-3 text-left p-5">
              <span className="flex-1">
                <span className="block font-titulo text-lg font-semibold leading-snug">{t.titulo}</span>
                <span className="block text-sm text-salvia">{t.resumen}</span>
              </span>
              <IconoAdelante className={`w-4 h-4 text-bosque shrink-0 transition-transform ${abiertoAqui ? 'rotate-90' : ''}`} />
            </button>
            {abiertoAqui && (
              <div className="px-5 pb-5 flex flex-col gap-3">
                {t.parrafos.map((p) => <p key={p}>{p}</p>)}
                {t.puntos && <ul className="flex flex-col gap-1 text-sm">{t.puntos.map((p) => <li key={p} className="font-bold">{p}</li>)}</ul>}
                {t.consultar && (
                  <div className="rounded-2xl bg-seleccion p-4 flex flex-col gap-1">
                    <p className="font-bold">Cuándo consultar</p>
                    <ul className="list-disc pl-5 text-sm flex flex-col gap-1">{t.consultar.map((c) => <li key={c}>{c}</li>)}</ul>
                  </div>
                )}
                <button type="button" className="btn-soft self-start" disabled={pensando}
                  onClick={() => preguntar(`Explícame más sobre "${t.titulo}"${paraPareja ? `, pensando en cómo acompañar a ${pareja || 'mi pareja'}` : ''}`)}>
                  <ColaBallena className="w-4 h-4" />Preguntarle a Payakan sobre esto
                </button>
              </div>
            )}
          </section>
        );
      })}
      <p className="text-xs text-salvia px-1">Información general basada en guías de ginecología. No reemplaza una consulta médica.</p>
    </div>
  );
}
