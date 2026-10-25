// Formulario para una idea de cita propia que no estaba en las listas: queda guardada, con su emoji, precio y tipo, para los próximos sorteos.
// Aquí también vive la lista de niveles de presupuesto (PRESUPUESTOS) que usa el asistente de citas.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAvisos } from '../lib/avisos';
import { precioStr } from '../lib/utils';
import { IconoCerrar, IconoDado } from './ui';
import type { Actividad as Act, CategoriaCita as Cat } from '../lib/tipos';
import type { PlanCita } from './CitaWizard';

/** Niveles de presupuesto que se ofrecen al crear una cita o una idea propia */
export const PRESUPUESTOS = [[1, 'Casi gratis'], [2, 'Normalito'], [3, 'Un gustico'], [4, 'Ocasión especial']] as const;
const EMOJIS_IDEA = ['✨', '🍽️', '🎬', '🎨', '🌳', '🎮', '🛍️', '🏠'];

/* Una idea de cita que no estaba en la lista: queda guardada para las próximas veces */
export default function IdeaPropia({ inicial, tipos, tipoInicial, onCreada, onCancelar }: { inicial?: PlanCita | null; tipos: Cat[]; tipoInicial?: string; onCreada: (a: Act) => void; onCancelar: () => void }) {
  const { revisar } = useAvisos();
  const [nombre, setNombre] = useState(inicial?.titulo.slice(0, 60) ?? '');
  const [descripcion, setDescripcion] = useState('');
  const [emoji, setEmoji] = useState(inicial?.emoji ?? EMOJIS_IDEA[0]);
  // El emoji del plan puede no estar entre los de siempre: se ofrece también
  const emojis = inicial && !EMOJIS_IDEA.includes(inicial.emoji) ? [inicial.emoji, ...EMOJIS_IDEA.slice(0, -1)] : EMOJIS_IDEA;
  const [precio, setPrecio] = useState(2);
  // Con el tipo de plan la idea vuelve a salir donde tiene sentido; arranca con el de esta cita
  const [categorias, setCategorias] = useState<string[]>(tipoInicial ? [tipoInicial] : []);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim() || guardando) return;
    setGuardando(true);
    const { data, error } = revisar(await supabase.from('actividades').insert({
      nombre: nombre.trim(), descripcion: descripcion.trim(), emoji, precio, categorias, nota: nota.trim() || null, es_comodin: true,
    }).select().single(), 'No pude guardar la idea');
    setGuardando(false);
    if (!error && data) onCreada(data);
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-titulo text-xl font-semibold">Tu idea de cita</p>
        <button onClick={onCancelar} className="btn-icon" aria-label="Cerrar sin guardar"><IconoCerrar className="w-4 h-4" /></button>
      </div>
      <label className="text-sm font-extrabold text-bosque-oscuro">¿Qué hacemos?
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: ir a patinar" maxLength={60} className="input mt-1.5 font-normal" />
      </label>
      <label className="text-sm font-extrabold text-bosque-oscuro">Cuéntame un poquito más (opcional)
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Lo que te imaginas del plan" maxLength={120} className="input mt-1.5 font-normal" />
      </label>
      <div>
        <p className="text-sm font-extrabold text-bosque-oscuro mb-1.5">Presupuesto</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Presupuesto">
          {PRESUPUESTOS.map(([n, etiqueta]) => (
            <button key={n} type="button" onClick={() => setPrecio(n)} data-active={precio === n} aria-pressed={precio === n} className="chip text-sm">
              <span className="font-extrabold">{precioStr(n)}</span> {etiqueta}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-extrabold text-bosque-oscuro mb-1.5">¿Qué tipo de plan es?</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de plan">
          {tipos.map((c) => {
            const sel = categorias.includes(c.slug);
            return <button key={c.slug} type="button" onClick={() => setCategorias(sel ? categorias.filter((x) => x !== c.slug) : [...categorias, c.slug])} data-active={sel} aria-pressed={sel} className="chip text-sm">{c.emoji} {c.nombre}</button>;
          })}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Emoji de la idea">
        {emojis.map((e) => <button key={e} type="button" onClick={() => setEmoji(e)} data-active={emoji === e} aria-pressed={emoji === e} className="chip text-xl px-0">{e}</button>)}
      </div>
      <label className="text-sm font-extrabold text-bosque-oscuro">Algo a tener en cuenta (opcional)
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: hay que reservar, solo abre fines de semana" maxLength={120} className="input mt-1.5 font-normal" />
      </label>
      <button onClick={guardar} disabled={!nombre.trim() || guardando} className="btn-primary">{guardando ? 'Guardando…' : 'Guardar y escoger esta idea'}</button>
    </div>
  );
}

/** El "¿No sabes? Ruleta": escoge una opción al azar y la ofrece para aceptarla */
export function Ruleta<T extends { emoji: string; nombre: string }>({ opciones, onPick }: { opciones: T[]; onPick: (o: T) => void }) {
  const [aleatorio, setAleatorio] = useState<T | null>(null);
  const [girando, setGirando] = useState(false);
  return (
    <div className="flex flex-col items-center gap-2">
      <button disabled={girando} onClick={() => { setGirando(true); setTimeout(() => { const r = opciones[Math.floor(Math.random() * opciones.length)]; setAleatorio(r); onPick(r); setGirando(false); }, 900); }}
        className="chip bg-durazno/40 border-durazno text-bosque-oscuro font-extrabold px-5 active:scale-95">
        <motion.span animate={girando ? { rotate: 360 } : { rotate: 0 }} transition={girando ? { repeat: Infinity, duration: 0.5, ease: 'linear' } : {}}><IconoDado className="w-5 h-5" /></motion.span>
        {girando ? 'Girando…' : '¿No sabes? Ruleta'}
      </button>
      {aleatorio && <p className="text-sm text-center text-salvia">Salió <b className="text-bosque">{aleatorio.emoji} {aleatorio.nombre}</b>: tócala para aceptarla o gira de nuevo</p>}
    </div>
  );
}
