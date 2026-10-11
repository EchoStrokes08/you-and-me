import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAvisos } from '../lib/avisos';
import { fechaBonita, fechaStr, hoy } from '../lib/utils';

// Los próximos 60 días: cada uno marca los que no puede. Un día bloqueado por cualquiera
// de los dos no se puede escoger al planear una cita. Cada quien quita solo los suyos.
export default function DiasNoPuedo() {
  const { perfil } = useAuth();
  const { revisar } = useAvisos();
  const [bloqueos, setBloqueos] = useState<{ fecha: string; creado_por: string }[]>([]);
  const [pareja, setPareja] = useState('tu amor');
  const yo = perfil?.id;

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('fechas_no_disponibles').select('fecha, creado_por');
    setBloqueos(data ?? []);
  }, []);

  useEffect(() => {
    cargar();
    supabase.from('configuracion').select('nombre_ella, nombre_el').eq('id', 1).single()
      .then(({ data }) => setPareja((perfil?.rol === 'admin' ? data?.nombre_ella : data?.nombre_el) ?? 'tu amor'));
  }, [cargar, perfil?.rol]);

  const toggle = async (s: string, mio: boolean) => {
    if (!yo) return;
    if (mio) revisar(await supabase.from('fechas_no_disponibles').delete().eq('fecha', s).eq('creado_por', yo), 'No pude liberar ese día');
    else revisar(await supabase.from('fechas_no_disponibles').insert({ fecha: s }), 'No pude bloquear ese día');
    cargar();
  };

  const base = hoy();
  const dias: string[] = [];
  for (let i = 0; i < 60; i++) { const d = new Date(base); d.setDate(d.getDate() + i); dias.push(fechaStr(d)); }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-salvia">Toca los días que no puedes. Los tachados son tuyos; los que marcó {pareja} salen con su nombre.</p>
      {[...new Set(dias.map((s) => s.slice(0, 7)))].map((mes) => {
        const mesDias = dias.filter((s) => s.startsWith(mes));
        const inicioSemana = new Date(mesDias[0] + 'T00:00:00').getDay();
        return (
          <section key={mes}>
            <h2 className="text-xl font-semibold first-letter:uppercase mb-2">
              {new Date(mes + '-01T00:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="grid grid-cols-7 text-center text-xs font-extrabold text-salvia mb-1">
              {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: inicioSemana }).map((_, i) => (
                <span key={'v-' + i} />
              ))}
              {mesDias.map((s) => {
                const d = new Date(s + 'T00:00:00');
                const mio = bloqueos.some((b) => b.fecha === s && b.creado_por === yo);
                const suyo = bloqueos.some((b) => b.fecha === s && b.creado_por !== yo);
                return (
                  <button key={s} onClick={() => toggle(s, mio)} aria-pressed={mio}
                    aria-label={`${fechaBonita(s)}${mio ? ', no puedes' : ''}${suyo ? `, ${pareja} no puede` : ''}`}
                    className={`min-h-14 py-1.5 px-0.5 rounded-2xl font-bold flex flex-col items-center justify-center transition-colors ${mio ? 'bg-durazno/50 text-coral' : suyo ? 'bg-espuma text-oceano border border-menta' : 'bg-tarjeta text-bosque border border-menta'}`}>
                    <span className={`block font-titulo text-lg leading-none ${mio ? 'line-through' : ''}`}>{d.getDate()}</span>
                    {suyo && <span className="block text-[10px] leading-tight truncate max-w-full px-0.5 mt-0.5">{pareja}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
