import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fechaStr, hoy } from '../lib/utils';
import { IconoFlecha } from './ui';

const ANIMOS = [
  ['😄', 'feliz'], ['💕', 'con mucho amor'], ['😌', 'en calma'], ['😴', 'con sueño'],
  ['😢', 'triste'], ['😤', 'con estrés'], ['🫠', 'sin energía'],
] as const;
const DIFICILES = ['triste', 'con estrés', 'sin energía'];

type Animo = { emoji: string; etiqueta: string } | null;

// Check-in diario: cómo me siento yo y cómo se siente el otro
export default function EstadoAnimo({ yo, pareja }: { yo: string; pareja: string }) {
  const [mio, setMio] = useState<Animo>(null);
  const [suyo, setSuyo] = useState<Animo>(null);
  const [cambiando, setCambiando] = useState(false);
  const [cartasMomento, setCartasMomento] = useState(0);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('estados_animo').select('*').eq('fecha', fechaStr(hoy()));
    setMio((data ?? []).find((a) => a.usuario_id === yo) ?? null);
    setSuyo((data ?? []).find((a) => a.usuario_id !== yo) ?? null);
  }, [yo]);

  useEffect(() => {
    cargar();
    supabase.rpc('cartas_recibidas').then(({ data }) => setCartasMomento((data ?? []).filter((c: any) => c.momento && !c.abierta_en).length));
  }, [cargar]);

  const elegir = async (emoji: string, etiqueta: string) => {
    setMio({ emoji, etiqueta });
    setCambiando(false);
    await supabase.from('estados_animo').upsert({ usuario_id: yo, fecha: fechaStr(hoy()), emoji, etiqueta });
  };

  const mostrarOpciones = !mio || cambiando;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">¿Cómo te sientes hoy?</p>
        {mio && !cambiando && <button onClick={() => setCambiando(true)} className="text-xs font-bold text-bosque">Cambiar</button>}
      </div>

      {mostrarOpciones ? (
        <div className="flex flex-wrap gap-2">
          {ANIMOS.map(([e, l]) => (
            <motion.button key={l} whileTap={{ scale: 0.9 }} onClick={() => elegir(e, l)} data-active={mio?.etiqueta === l} className="chip">
              <span className="text-lg">{e}</span> {l}
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-seleccion border border-menta p-3 text-center">
            <p className="text-3xl">{mio!.emoji}</p>
            <p className="text-xs font-bold text-bosque mt-1">Tú: {mio!.etiqueta}</p>
          </div>
          <div className="rounded-2xl bg-crema border border-menta p-3 text-center">
            <p className="text-3xl">{suyo?.emoji ?? '⏳'}</p>
            <p className="text-xs font-bold text-salvia mt-1">{pareja}: {suyo?.etiqueta ?? 'aún no cuenta'}</p>
          </div>
        </div>
      )}

      {mio && DIFICILES.includes(mio.etiqueta) && cartasMomento > 0 && (
        <Link to="/cartas" className="flex items-center gap-2 rounded-2xl bg-durazno/25 border border-durazno/50 px-3 py-2 text-sm font-bold text-bosque-oscuro">
          💌 {pareja} te dejó {cartasMomento === 1 ? 'una carta' : `${cartasMomento} cartas`} para momentos así
          <IconoFlecha className="w-4 h-4 ml-auto text-coral" />
        </Link>
      )}
      {suyo && DIFICILES.includes(suyo.etiqueta) && (
        <Link to="/cartas" className="flex items-center gap-2 rounded-2xl bg-seleccion border border-menta px-3 py-2 text-sm font-bold text-bosque">
          💚 {pareja} no está en su mejor día. ¿Le escribes una carta o le mandas un "Pienso en ti"?
          <IconoFlecha className="w-4 h-4 ml-auto" />
        </Link>
      )}
    </div>
  );
}
