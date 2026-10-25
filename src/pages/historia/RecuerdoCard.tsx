// La tarjeta de cada entrada de la historia: muestra el recuerdo con su portada, corazones, fotos
// y notas (que se piden solo al abrir), se deja editar o borrar en agree con quién la escribió.
// Es la pieza principal de la pantalla Historia.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { fechaBonita } from '../../lib/utils';
import type { Foto } from '../../lib/fotos';
import type { Perfil } from '../../context/AuthContext';
import { useAvisos } from '../../lib/avisos';
import { Corazon, IconoAmpliar, IconoCamara, IconoCheck, IconoLapiz, IconoPin, IconoPlay, VisorFotos } from '../../components/ui';
import Cancion from '../../components/Cancion';
import FormRecuerdo from './FormRecuerdo';
import type { CancionRecuerdo, NotaRecuerdo, Recuerdo } from './tipos';

type PropsRecuerdoCard = {
  r: Recuerdo;
  fotos: Foto[];
  /** Perfil de quien está en la app; null mientras no cargue */
  perfil: Perfil | null;
  /** Cómo se le dice a la pareja para las notas escritas por ella */
  pareja: string;
  /** Se abrió de una vez ("Un día como hoy" o al llegar un aviso) */
  destacado?: boolean;
  /** Acaba de guardarse: se revela con la foto lavándose a nítida */
  recien?: boolean;
  puedeEditar: boolean;
  onCambio: () => void;
  onBorrar: () => void;
  onFavorita: (f: Foto) => void;
};

/** Una entrada de la historia: portada, fecha, corazones, fotos, notas y canciones.
    Los datos de notas y canciones se piden solo cuando el recuerdo se abre. */
export default function RecuerdoCard({ r, fotos, perfil, pareja, destacado = false, recien = false, puedeEditar, onCambio, onBorrar, onFavorita }: PropsRecuerdoCard) {
  const { revisar, confirmar, pedirTexto } = useAvisos();
  const [open, setOpen] = useState(destacado);
  const [editando, setEditando] = useState(false);
  const [notas, setNotas] = useState<NotaRecuerdo[]>([]);
  const [canciones, setCanciones] = useState<CancionRecuerdo[]>([]);
  const [texto, setTexto] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  // La portada es la primera foto favorita o, si no hay, la primera; los videos se ven al abrir el recuerdo
  const portada = fotos.find((f) => f.tipo !== 'video' && f.favorita) ?? fotos.find((f) => f.tipo !== 'video');
  const nVideos = fotos.filter((f) => f.tipo === 'video').length;
  const nFotos = fotos.length - nVideos;
  // Lo que se puede ver en grande, y cuál se está viendo
  const visor = useMemo(() => fotos.map((f, i) => ({ url: f.url, alt: `${f.tipo === 'video' ? 'Video' : 'Foto'} ${i + 1} de ${r.titulo}`, video: f.tipo === 'video', favorita: f.favorita })), [fotos, r.titulo]);
  const [viendo, setViendo] = useState<number | null>(null);
  useEffect(() => {
    if (destacado || recien) setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  }, [destacado, recien]);
  const cargarNotas = useCallback(() => supabase.from('notas_recuerdo').select('*').eq('recuerdo_id', r.id).order('created_at').then(({ data }) => setNotas(data ?? [])), [r.id]);
  useEffect(() => {
    if (!open) return;
    cargarNotas();
    supabase.from('canciones').select('*').eq('recuerdo_id', r.id).then(({ data }) => setCanciones(data ?? []));
  }, [open, r.id, cargarNotas]);
  const guardarNota = async () => {
    if (!texto.trim()) return;
    const { error } = revisar(await supabase.from('notas_recuerdo').insert({ recuerdo_id: r.id, usuario_id: perfil?.id ?? '', texto: texto.trim() }), 'No pude guardar la nota');
    if (error) return;
    setTexto('');
    cargarNotas();
  };
  // Cada uno corrige o borra solo lo que escribió
  const editarNota = async (n: NotaRecuerdo) => {
    const nuevo = await pedirTexto({ titulo: 'Lo mejor para mí fue…', inicial: n.texto, boton: 'Guardar' });
    if (nuevo === null || !nuevo.trim() || nuevo.trim() === n.texto) return;
    revisar(await supabase.from('notas_recuerdo').update({ texto: nuevo.trim() }).eq('id', n.id), 'No pude guardar la nota');
    cargarNotas();
  };
  const borrarNota = async (n: NotaRecuerdo) => {
    if (!(await confirmar({ titulo: '¿Borrar tu nota?', texto: `«${n.texto}»`, boton: 'Borrar', peligro: true }))) return;
    revisar(await supabase.from('notas_recuerdo').delete().eq('id', n.id), 'No pude borrar la nota');
    cargarNotas();
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
    // Recién guardado: la tarjeta se posa y la foto se revela, de lavada y borrosa a nítida
    <motion.div ref={ref} initial={recien ? { opacity: 0, y: -14, scale: 0.96 } : false} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`relative card p-0 overflow-visible ${destacado || recien ? 'ring-2 ring-esmeralda' : ''}`}>
      <span className="absolute -left-[31px] top-5 w-4 h-4 rounded-full bg-tarjeta border-[3px] border-esmeralda" />
      {/* La portada abre el recuerdo; ya abierto, se ve en grande */}
      {portada && (
        <button onClick={() => (open ? setViendo(fotos.indexOf(portada)) : setOpen(true))} aria-label={open ? `Ver en grande la foto de ${r.titulo}` : `Abrir ${r.titulo}`}
          className={`block w-full relative overflow-hidden rounded-t-[1.75rem] ${open ? 'cursor-zoom-in' : ''}`}>
          <motion.img src={portada.url || undefined} loading="lazy" decoding="async" alt={`Foto de ${r.titulo}`} className="w-full h-52 object-cover bg-seleccion"
            initial={recien ? { filter: 'blur(16px) saturate(0) brightness(1.6)' } : false} animate={{ filter: 'blur(0px) saturate(1) brightness(1)' }} transition={{ duration: 1.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} />
          {fotos.length > 1 && <span className="absolute top-3 right-3 badge bg-pino/80 text-white text-sm"><IconoCamara className="w-4 h-4" /> {nFotos}{nVideos > 0 && <><IconoPlay className="w-3.5 h-3.5 ml-1.5" /> {nVideos}</>}</span>}
        </button>
      )}
      <button onClick={() => setOpen(!open)} className="text-left w-full" aria-expanded={open}>
        <div className="p-4">
          <p className="font-titulo text-2xl font-semibold leading-tight">{r.titulo}</p>
          <p className="text-sm text-salvia mt-1 first-letter:uppercase">{fechaBonita(r.fecha)}</p>
          {r.lugar_texto && <p className="text-sm text-salvia flex items-center gap-1"><IconoPin className="w-4 h-4 shrink-0" /> {r.lugar_texto}</p>}
          <div className="flex gap-0.5 mt-2 text-bosque" role="img" aria-label={`${r.calificacion} de 5 corazones`}>{[1, 2, 3, 4, 5].map((n) => <Corazon key={n} className="w-5 h-5" lleno={n <= r.calificacion} />)}</div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 flex flex-col gap-3">
              {(fotos.length > 1 || nVideos > 0) && (
                <div className="flex overflow-x-auto gap-2 snap-x -mx-4 px-4">
                  {fotos.map((f, i) => f.tipo === 'video'
                    ? (
                      <div key={f.id} className="relative flex-shrink-0 snap-start">
                        <video src={f.url || undefined} controls playsInline preload="metadata" aria-label={`Video ${i + 1} de ${r.titulo}`} className="rounded-2xl h-40 max-w-[16rem] bg-pino" />
                        {/* Se pausa el chiquito para que no suenen los dos */}
                        <button onClick={(e) => { e.currentTarget.parentElement?.querySelector('video')?.pause(); setViendo(i); }} aria-label={`Ver en grande el video ${i + 1} de ${r.titulo}`}
                          className="absolute top-2 right-2 w-9 h-9 rounded-full bg-pino/80 text-white flex items-center justify-center active:scale-90 transition"><IconoAmpliar /></button>
                      </div>
                    )
                    : (
                      <button key={f.id} onClick={() => setViendo(i)} aria-label={`Ver en grande la foto ${i + 1} de ${r.titulo}`} className="flex-shrink-0 snap-start cursor-zoom-in">
                        <img src={f.url || undefined} loading="lazy" decoding="async" alt="" className="rounded-2xl w-40 h-40 object-cover bg-seleccion" />
                      </button>
                    ))}
                </div>
              )}
              {r.descripcion && <p className="leading-relaxed whitespace-pre-wrap">{r.descripcion}</p>}
              {canciones.map((c) => <Cancion key={c.id} c={c} />)}
              {notas.map((n) => {
                const mia = n.usuario_id === perfil?.id;
                return (
                  <div key={n.id} className={`border border-menta rounded-2xl px-3 py-2 ${mia ? 'bg-seleccion' : 'bg-crema'}`}>
                    <p className="text-sm font-bold text-salvia">Lo mejor para {mia ? 'mí' : pareja}</p>
                    <p className="font-titulo italic text-lg leading-snug whitespace-pre-wrap">{n.texto}</p>
                    {mia && (
                      <div className="flex gap-4 text-sm font-bold -mb-1.5">
                        <button onClick={() => editarNota(n)} className="text-bosque min-h-11 flex items-center gap-1.5"><IconoLapiz className="w-4 h-4" /> Editar</button>
                        <button onClick={() => borrarNota(n)} className="text-coral min-h-11">Borrar</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex gap-2">
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Lo mejor para mí fue…" aria-label="Lo mejor para mí fue" className="input py-2" />
                <button onClick={guardarNota} className="btn-primary min-w-12 px-3 py-2" aria-label="Guardar nota"><IconoCheck /></button>
              </div>
              {puedeEditar && (
                <div className="flex items-center gap-4 text-sm font-bold">
                  <button onClick={() => setEditando(true)} className="text-bosque min-h-11 flex items-center gap-1.5"><IconoLapiz className="w-4 h-4" /> Editar o cambiar fotos</button>
                  <button onClick={onBorrar} className="text-coral ml-auto min-h-11 px-2 -mr-2">Borrar</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <VisorFotos fotos={visor} indice={viendo} onCambio={setViendo} onFavorita={(i) => onFavorita(fotos[i])} />
    </motion.div>
  );
}
