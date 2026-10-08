import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAvisos } from '../lib/avisos';
import { subirAudio, type Audio } from '../lib/voz';
import { Grabadora, NotaDeVoz } from './Voz';
import { Corazon } from './ui';

const haceCuanto = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
};

// Se ve la nota más reciente y las anteriores van saliendo de a poquitos
const VOCES_POR_PAGINA = 3;

// Un toque y al otro le llega "está pensando en ti"; también con nota de voz.
// Va dentro de la tarjeta "Nosotros hoy" del inicio, por eso no trae tarjeta propia
export default function PiensoEnTi({ yo, pareja }: { yo: string; pareja: string }) {
  const { aviso, revisar } = useAvisos();
  const [semana, setSemana] = useState({ mios: 0, suyos: 0 });
  const [voces, setVoces] = useState<any[]>([]);
  const [totalVoces, setTotalVoces] = useState(0);
  // Cuántas notas se están mostrando (para que al recargar no se vuelvan a esconder)
  const limite = useRef(1);
  const [enviando, setEnviando] = useState(false);
  const [estallido, setEstallido] = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [grabando, setGrabando] = useState(false);
  const [audio, setAudio] = useState<Audio | null>(null);

  // Notas de voz de la pareja (todas, no solo las de la semana), de la más nueva a la más vieja
  const cargarVoces = useCallback(async (n: number) => {
    const { data, count } = await supabase.from('pensamientos').select('id, audio, duracion, created_at', { count: 'exact' })
      .neq('de', yo).not('audio', 'is', null).order('created_at', { ascending: false }).range(0, n - 1);
    setVoces(data ?? []);
    setTotalVoces(count ?? 0);
  }, [yo]);

  const cargar = useCallback(async () => {
    const desde = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data } = await supabase.from('pensamientos').select('de').gte('created_at', desde);
    const lista = data ?? [];
    setSemana({ mios: lista.filter((p) => p.de === yo).length, suyos: lista.filter((p) => p.de !== yo).length });
    cargarVoces(limite.current);
  }, [yo, cargarVoces]);

  const verVoces = (n: number) => { limite.current = n; cargarVoces(n); };
  const faltan = totalVoces - voces.length;

  useEffect(() => {
    cargar();
    // Si te piensa mientras tienes la app abierta, el contador se actualiza solo
    const ch = supabase.channel('pensamientos-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pensamientos' }, (p: any) => {
        if (p.new.de !== yo) setEstallido((n) => n + 1);
        cargar();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [yo, cargar]);

  const decir = (t: string, ms = 2500) => { setMensaje(t); setTimeout(() => setMensaje(''), ms); };

  const enviar = async (conAudio?: Audio | null) => {
    setEnviando(true);
    let ruta: string | null = null;
    if (conAudio) {
      ruta = await subirAudio(`pensamientos/${yo}`, conAudio);
      if (!ruta) { setEnviando(false); aviso('No pude subir la nota de voz 😢 Intenta de nuevo.', 'error'); return; }
    }
    const { error } = await supabase.from('pensamientos').insert(ruta ? { audio: ruta, duracion: conAudio!.segundos } : {});
    setEnviando(false);
    if (error) {
      if (ruta) await supabase.storage.from('adjuntos').remove([ruta]);
      // El límite de uno cada 10 segundos no es un error de verdad
      if (/momentico/.test(error.message)) decir('Espera un momentico 💚', 2000);
      else revisar({ error }, 'No pude enviarlo');
      return;
    }
    setEstallido((n) => n + 1);
    decir(ruta ? `${pareja} va a escuchar tu nota 🎙️💚` : `Se lo dije a ${pareja} 💚`);
    if (ruta) { setGrabando(false); setAudio(null); }
    cargar();
  };

  return (
    <div className="flex flex-col gap-3 relative">
      <div className="flex items-center gap-4">
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => enviar()} disabled={enviando} aria-label="Pienso en ti"
          className="relative shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-esmeralda to-hondo text-lima flex items-center justify-center shadow-soft">
          <Corazon className="w-8 h-8" />
          <AnimatePresence>
            {estallido > 0 && Array.from({ length: 6 }).map((_, i) => (
              <motion.span key={`${estallido}-${i}`} className="absolute text-esmeralda pointer-events-none"
                initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
                animate={{ x: Math.cos((i / 6) * Math.PI * 2) * 46, y: Math.sin((i / 6) * Math.PI * 2) * 46 - 10, opacity: 0, scale: 1 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}>
                <Corazon className="w-4 h-4" />
              </motion.span>
            ))}
          </AnimatePresence>
        </motion.button>
        <div className="flex-1 min-w-0">
          <p className="eyebrow">Pienso en ti</p>
          <p className="font-titulo text-lg font-semibold leading-tight">{mensaje || `Toca el corazón y ${pareja} lo sabrá`}</p>
          <p className="text-xs text-salvia mt-0.5">Esta semana: tú {semana.mios} · {pareja} {semana.suyos}</p>
        </div>
        <button onClick={() => { setGrabando(!grabando); setAudio(null); }} aria-label="Mandar una nota de voz" aria-expanded={grabando}
          className={`btn-icon shrink-0 ${grabando ? 'bg-seleccion border-esmeralda' : ''}`}>🎙️</button>
      </div>

      <AnimatePresence>
        {grabando && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-2 pt-1">
              <Grabadora onCambio={setAudio} maxSegundos={60} etiqueta={`Grabarle algo a ${pareja}`} />
              {audio && <button onClick={() => enviar(audio)} disabled={enviando} className="btn-primary py-2.5">{enviando ? 'Enviando…' : 'Enviar nota de voz 💚'}</button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {voces.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-menta pt-3">
          <p className="eyebrow">Notas de voz de {pareja}</p>
          {voces.map((v) => (
            <div key={v.id} className="flex flex-col gap-1">
              <NotaDeVoz ruta={v.audio} segundos={v.duracion} />
              <span className="text-[11px] text-salvia font-semibold pl-3">{haceCuanto(v.created_at)}</span>
            </div>
          ))}
          {(faltan > 0 || voces.length > 1) && (
            <div className="flex gap-4 text-xs font-bold pl-3">
              {faltan > 0 && (
                <button onClick={() => verVoces(voces.length + VOCES_POR_PAGINA)} className="text-bosque">
                  Ver anteriores ({faltan})
                </button>
              )}
              {voces.length > 1 && <button onClick={() => verVoces(1)} className="text-salvia ml-auto">Ver solo la última</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
