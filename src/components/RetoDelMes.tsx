import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { useAvisos } from '../lib/avisos';
import { fechaStr, hoy } from '../lib/utils';
import HeartRain from './HeartRain';
import { IconoCamara, IconoCheck, IconoDado, IconoMedalla } from './ui';

type Reto = Database['public']['Functions']['reto_del_mes']['Returns'][number];

const nombreMes = (mes: string) => new Date(mes + 'T00:00:00').toLocaleDateString('es-CO', { month: 'long' });

// Una misión de pareja por mes. Al cumplirla se puede guardar como recuerdo.
export default function RetoDelMes({ compacto = false }: { compacto?: boolean }) {
  const { revisar, aviso } = useAvisos();
  const navigate = useNavigate();
  const [reto, setReto] = useState<Reto | null>(null);
  const [celebrando, setCelebrando] = useState(false);

  const cargar = () => supabase.rpc('reto_del_mes').then(({ data }) => setReto(data?.[0] ?? null));
  useEffect(() => { cargar(); }, []);

  if (!reto) return null;
  const dia = hoy().getDate();
  const ultimo = new Date(hoy().getFullYear(), hoy().getMonth() + 1, 0).getDate();
  const quedan = ultimo - dia;

  // En el inicio solo sale los últimos 10 días del mes y si aún no está cumplido
  if (compacto) {
    if (reto.cumplido_en || quedan > 10) return null;
    return (
      <button onClick={() => navigate('/juntos')} className="fila-aviso min-h-14 text-left w-full">
        <IconoMedalla className="w-5 h-5 text-bosque shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">{quedan === 0 ? 'Hoy es el último día para el reto' : `Quedan ${quedan} ${quedan === 1 ? 'día' : 'días'} para el reto del mes`}</p>
          <p className="text-sm text-salvia truncate">{reto.texto}</p>
        </div>
      </button>
    );
  }

  const cumplir = async () => {
    const { error } = revisar(await supabase.from('retos_mes').update({ cumplido_en: fechaStr(hoy()) }).eq('mes', reto.mes), 'No pude marcarlo');
    if (error) return;
    setCelebrando(true);
    cargar();
  };
  const deshacer = async () => {
    revisar(await supabase.from('retos_mes').update({ cumplido_en: null }).eq('mes', reto.mes), 'No pude deshacerlo');
    cargar();
  };
  const otro = async () => {
    const { error } = revisar(await supabase.rpc('cambiar_reto_del_mes'), 'No pude cambiarlo');
    if (!error) { aviso('Ahí va otro 🎲'); cargar(); }
  };
  const guardarRecuerdo = () => navigate('/historia', { state: { reto: { mes: reto.mes, titulo: `${reto.emoji} ${reto.texto}`, fecha: reto.cumplido_en ?? fechaStr(hoy()) } } });

  return (
    <section className="card-hero" aria-label="Reto del mes">
      <div className="flex items-start gap-3">
        <span className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center ${reto.cumplido_en ? 'bg-lima text-pino' : 'bg-white/15 text-lima'}`}>
          {reto.cumplido_en ? <IconoCheck className="w-6 h-6" /> : <IconoMedalla className="w-6 h-6" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] opacity-80">Reto de {nombreMes(reto.mes)}</p>
          <p className="font-titulo text-xl font-semibold leading-tight mt-1">{reto.texto}</p>
          <p className="text-sm mt-1 opacity-85">{reto.cumplido_en ? '¡Lo cumplieron! 💚' : quedan === 0 ? 'Hoy es el último día' : `Quedan ${quedan} ${quedan === 1 ? 'día' : 'días'}`}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        {!reto.cumplido_en ? (
          <>
            <button onClick={cumplir} className="btn-soft flex-1">¡Lo cumplimos!</button>
            <button onClick={otro} className="btn-icon bg-white/15 border-white/20 text-white" aria-label="Darme otro reto"><IconoDado className="w-5 h-5" /></button>
          </>
        ) : reto.recuerdo_id ? (
          <button onClick={() => navigate('/historia', { state: { abrir: reto.recuerdo_id } })} className="btn-soft flex-1"><IconoCamara className="w-5 h-5" /> Ver el recuerdo</button>
        ) : (
          <>
            <button onClick={guardarRecuerdo} className="btn-soft flex-1"><IconoCamara className="w-5 h-5" /> Guardarlo como recuerdo</button>
            <button onClick={deshacer} className="min-h-11 px-3 text-sm font-bold text-white/85">Deshacer</button>
          </>
        )}
      </div>

      <AnimatePresence>
        {celebrando && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-crema/95 z-50 flex items-center justify-center p-6 text-bosque-oscuro">
            <HeartRain />
            <div className="max-w-sm w-full flex flex-col gap-3 text-center items-center">
              <span className="w-20 h-20 rounded-full bg-hondo text-lima flex items-center justify-center"><IconoMedalla className="w-10 h-10" /></span>
              <h2 className="text-3xl font-bold">¡Reto cumplido!</h2>
              <p className="text-salvia font-semibold">{reto.texto}</p>
              <button onClick={guardarRecuerdo} className="btn-primary w-full mt-2">Guardarlo como recuerdo</button>
              <button onClick={() => setCelebrando(false)} className="btn-soft w-full">Después</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
