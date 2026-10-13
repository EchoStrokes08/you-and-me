import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fechaStr, hoy } from '../lib/utils';
import { Corazon, IconoCalendario, IconoCarta, IconoFlecha } from './ui';
import HistorialAnimo from './HistorialAnimo';
import { useAvisos } from '../lib/avisos';

// Cada ánimo lleva un emoji distinto: el aviso a la pareja solo sale cuando cambia el emoji
const ANIMOS = [
  ['😄', 'feliz'], ['💕', 'con mucho amor'], ['😌', 'chill'], ['🤩', 'con toda la energía'],
  ['🥰', 'con ganas de mimos'], ['🥺', 'con ganas de verte'], ['🤪', 'me comí un payasito'], ['🙏', 'con gratitud'],
  ['💪', 'con orgullo'], ['🍕', 'con hambre'], ['☁️', 'en las nubes'], ['🥹', 'sensible'],
  ['😴', 'con sueño'], ['🫠', 'sin energía'], ['🤒', 'con malestar'], ['😰', 'con ansiedad'],
  ['😤', 'con estrés'], ['😠', 'de mal genio'], ['😢', 'triste'],
] as const;
// Los mismos que en api/notificar.ts
// Los primeros se ven siempre; el resto aparece con "Ver más"
const A_LA_VISTA = 6;
const DIFICILES = ['triste', 'con estrés', 'sin energía', 'con malestar', 'con ansiedad', 'de mal genio'];

type Animo = { emoji: string; etiqueta: string } | null;

// Check-in diario: cómo me siento yo y cómo se siente el otro.
// Va dentro de la tarjeta "Nosotros hoy" del inicio; ya escogido, ocupa una sola línea
export default function EstadoAnimo({ yo, pareja, cartasMomento }: { yo: string; pareja: string; cartasMomento: number }) {
  const { revisar } = useAvisos();
  const [mio, setMio] = useState<Animo>(null);
  const [suyo, setSuyo] = useState<Animo>(null);
  const [cambiando, setCambiando] = useState(false);
  const [todos, setTodos] = useState(false);
  const [historial, setHistorial] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('estados_animo').select('*').eq('fecha', fechaStr(hoy()));
    setMio((data ?? []).find((a) => a.usuario_id === yo) ?? null);
    setSuyo((data ?? []).find((a) => a.usuario_id !== yo) ?? null);
  }, [yo]);

  useEffect(() => {
    cargar();
    // Cuando el otro cuenta cómo se siente, aparece sin recargar
    const ch = supabase.channel('animo-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'estados_animo' }, () => cargar()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  const elegir = async (emoji: string, etiqueta: string) => {
    setMio({ emoji, etiqueta });
    setCambiando(false);
    setTodos(false);
    const { error } = revisar(await supabase.from('estados_animo').upsert({ usuario_id: yo, fecha: fechaStr(hoy()), emoji, etiqueta }), 'No pude guardar cómo te sientes');
    if (error) cargar();
  };

  const mostrarOpciones = !mio || cambiando;

  return (
    <div className="flex flex-col gap-2.5">
      {mostrarOpciones ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow">¿Cómo te sientes hoy?</p>
            {cambiando && <button onClick={() => { setCambiando(false); setTodos(false); }} className="text-sm font-bold text-salvia min-h-11 px-2 -my-3 -mr-2">Cancelar</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* El que ya escogió se ve aunque sea de los escondidos */}
            {ANIMOS.filter(([, l], i) => todos || i < A_LA_VISTA || mio?.etiqueta === l).map(([e, l]) => (
              <motion.button key={l} whileTap={{ scale: 0.9 }} onClick={() => elegir(e, l)} data-active={mio?.etiqueta === l} className="chip py-2">
                <span className="text-lg">{e}</span> {l}
              </motion.button>
            ))}
            <button onClick={() => setTodos(!todos)} aria-expanded={todos} className="chip py-2 border-dashed text-salvia">
              {todos ? 'Ver menos' : `Ver más (${ANIMOS.length - A_LA_VISTA})`}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow">Hoy nos sentimos</p>
            <button onClick={() => setCambiando(true)} className="text-sm font-bold text-bosque min-h-11 px-2 -my-3 -mr-2">Cambiar</button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge bg-seleccion border border-menta text-bosque py-1.5 text-sm"><span className="text-base leading-none">{mio!.emoji}</span> Tú: {mio!.etiqueta}</span>
            <span className="badge bg-crema border border-menta text-salvia py-1.5 text-sm"><span className="text-base leading-none">{suyo?.emoji ?? '⏳'}</span> {pareja}: {suyo?.etiqueta ?? 'aún no cuenta'}</span>
          </div>
        </>
      )}

      <button onClick={() => setHistorial(true)} className="self-start min-h-11 -my-1.5 text-sm font-bold text-bosque flex items-center gap-1.5">
        <IconoCalendario className="w-4 h-4" /> Ver cómo nos hemos sentido
      </button>
      <HistorialAnimo abierta={historial} onClose={() => setHistorial(false)} yo={yo} pareja={pareja} />

      {mio && DIFICILES.includes(mio.etiqueta) && cartasMomento > 0 && (
        <Link to="/cartas" className="flex items-center gap-2 min-h-11 rounded-2xl bg-durazno/25 border border-durazno/50 px-3 py-2 text-sm font-bold text-bosque-oscuro">
          <IconoCarta className="w-5 h-5 shrink-0 text-coral" />
          <span className="flex-1">{pareja} te dejó {cartasMomento === 1 ? 'una carta' : `${cartasMomento} cartas`} para momentos así</span>
          <IconoFlecha className="w-4 h-4 shrink-0 text-coral" />
        </Link>
      )}
      {suyo && DIFICILES.includes(suyo.etiqueta) && (
        <Link to="/cartas" className="flex items-center gap-2 min-h-11 rounded-2xl bg-seleccion border border-menta px-3 py-2 text-sm font-bold text-bosque">
          <Corazon className="w-5 h-5 shrink-0" />
          <span className="flex-1">{pareja} no está en su mejor día. ¿Le escribes una carta o le mandas un "Pienso en ti"?</span>
          <IconoFlecha className="w-4 h-4 shrink-0" />
        </Link>
      )}
    </div>
  );
}
