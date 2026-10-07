import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Corazon } from './ui';

// Un toque y al otro le llega "está pensando en ti"
export default function PiensoEnTi({ yo, pareja }: { yo: string; pareja: string }) {
  const [semana, setSemana] = useState({ mios: 0, suyos: 0 });
  const [enviando, setEnviando] = useState(false);
  const [estallido, setEstallido] = useState(0);
  const [aviso, setAviso] = useState('');

  const cargar = async () => {
    const desde = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data } = await supabase.from('pensamientos').select('de').gte('created_at', desde);
    const lista = data ?? [];
    setSemana({ mios: lista.filter((p) => p.de === yo).length, suyos: lista.filter((p) => p.de !== yo).length });
  };

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
  }, [yo]);

  const enviar = async () => {
    setEnviando(true);
    const { error } = await supabase.from('pensamientos').insert({});
    setEnviando(false);
    if (error) { setAviso('Espera un momentico 💚'); setTimeout(() => setAviso(''), 2000); return; }
    setEstallido((n) => n + 1);
    setAviso(`Se lo dije a ${pareja} 💚`);
    setTimeout(() => setAviso(''), 2500);
    cargar();
  };

  return (
    <div className="card flex items-center gap-4 relative overflow-hidden">
      <motion.button whileTap={{ scale: 0.85 }} onClick={enviar} disabled={enviando} aria-label="Pienso en ti"
        className="relative shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-esmeralda to-bosque text-lima flex items-center justify-center shadow-soft">
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
        <p className="font-titulo text-lg font-semibold leading-tight">{aviso || `Toca el corazón y ${pareja} lo sabrá`}</p>
        <p className="text-xs text-salvia mt-0.5">Esta semana: tú {semana.mios} · {pareja} {semana.suyos}</p>
      </div>
    </div>
  );
}
