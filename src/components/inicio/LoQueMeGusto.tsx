// "Lo que me gustó de hoy": una frase corta que se escribe desde las 6 p. m. y el otro la lee al día siguiente.
// Antes de esa hora la tarjeta no deja escribir: solo muestra lo que ya quedó (el de ayer o el de hoy).
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAvisos } from '../../lib/avisos';
import { fechaStr, hoy, hoyStr } from '../../lib/utils';
import { IconoCheck, IconoLapiz, IconoSol } from '../ui';

// Desde las 6 p. m. se puede escribir; antes solo se ve si ya está escrito
const HORA_ESCRIBIR = 18;

// "Lo que me gustó de hoy": una frase corta que el otro lee al día siguiente.
// Arriba, lo que el otro dejó ayer; abajo, lo de hoy (desde la tarde).
export default function LoQueMeGusto({ yo, pareja }: { yo: string; pareja: string }) {
  const { revisar, aviso } = useAvisos();
  const [suyo, setSuyo] = useState<string | null>(null);
  const [mio, setMio] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [puedeEscribir] = useState(() => new Date().getHours() >= HORA_ESCRIBIR);

  useEffect(() => {
    const ayer = hoy(); ayer.setDate(ayer.getDate() - 1);
    supabase.from('gratitudes').select('texto').neq('usuario_id', yo).eq('fecha', fechaStr(ayer)).maybeSingle().then(({ data }) => setSuyo(data?.texto ?? null));
    supabase.from('gratitudes').select('texto').eq('usuario_id', yo).eq('fecha', hoyStr()).maybeSingle().then(({ data }) => setMio(data?.texto ?? null));
  }, [yo]);

  const guardar = async () => {
    if (!texto.trim()) return;
    setGuardando(true);
    const { error } = revisar(await supabase.from('gratitudes').upsert({ usuario_id: yo, fecha: hoyStr(), texto: texto.trim() }, { onConflict: 'usuario_id,fecha' }), 'No pude guardarlo');
    setGuardando(false);
    if (error) return;
    setMio(texto.trim());
    setEditando(false);
    aviso(`${pareja} lo va a leer mañana 💚`);
  };

  if (!suyo && !mio && !puedeEscribir) return null;

  return (
    <section className="card flex flex-col gap-4" aria-label="Lo que me gustó de hoy">
      {suyo && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <p className="eyebrow flex items-center gap-1.5"><IconoSol className="w-4 h-4" /> Lo que más le gustó a {pareja} de ayer</p>
          <p className="font-titulo italic text-[1.2rem] leading-[1.5] mt-2 text-bosque-oscuro">«{suyo}»</p>
        </motion.div>
      )}
      {suyo && (mio || puedeEscribir) && <div className="border-t border-menta -mx-5" />}
      {mio && !editando ? (
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 shrink-0 rounded-full bg-seleccion text-bosque flex items-center justify-center"><IconoCheck /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">Ya le dejaste lo de hoy</p>
            <p className="text-sm text-salvia truncate">«{mio}»</p>
          </div>
          <button onClick={() => { setTexto(mio); setEditando(true); }} className="min-h-11 px-2 text-sm text-bosque font-bold flex items-center gap-1.5 shrink-0"><IconoLapiz className="w-4 h-4" /> Editar</button>
        </div>
      ) : puedeEscribir && (
        <div className="flex flex-col gap-2">
          <label htmlFor="me-gusto" className="font-titulo text-lg font-semibold leading-tight">¿Qué fue lo que más te gustó de hoy?</label>
          <p className="text-sm text-salvia -mt-1">{pareja} lo lee mañana en la mañana.</p>
          <textarea id="me-gusto" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={280} rows={2} placeholder="Cuando me mandaste esa foto…" className="input resize-none" />
          <button onClick={guardar} disabled={!texto.trim() || guardando} className="btn-primary">{guardando ? 'Guardando…' : 'Dejárselo'}</button>
        </div>
      )}
    </section>
  );
}
