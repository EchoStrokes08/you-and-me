import { useEffect, useState } from 'react';
import { armarCopia, entregarArchivo, type Progreso } from '../lib/copia';
import { useAvisos } from '../lib/avisos';
import { diasSinCopia, DIAS_ENTRE_COPIAS, hoyStr } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { IconoDescarga } from './ui';

const textoUltimaCopia = (ultima: string | null) => {
  const d = diasSinCopia(ultima);
  return d === null ? 'Todavía no has descargado ninguna copia' : d === 0 ? 'Última copia: hoy' : d === 1 ? 'Última copia: ayer' : `Última copia: hace ${d} días`;
};

// Botón al final de Historia: descarga un ZIP con los recuerdos, fotos y cartas
export default function CopiaSeguridad() {
  const { aviso } = useAvisos();
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  // Solo el admin lleva la cuenta de cuándo fue la última copia (y recibe el recordatorio)
  const esAdmin = !!useAuth().perfil?.esAdmin;
  const [ultima, setUltima] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!esAdmin) return;
    supabase.from('configuracion').select('ultima_copia').eq('id', 1).single().then(({ data }) => setUltima(data?.ultima_copia ?? null));
  }, [esAdmin]);

  const descargar = async () => {
    setProgreso({ paso: 'Empezando…' });
    try {
      const blob = await armarCopia(setProgreso);
      const r = await entregarArchivo(blob, `you-and-me-copia-${hoyStr()}.zip`);
      if (r !== 'cancelado') {
        aviso(r === 'compartido' ? 'Copia lista 💾 Guárdala en Archivos' : 'Copia descargada 💾');
        if (esAdmin) {
          const ahora = new Date().toISOString();
          const { error } = await supabase.from('configuracion').update({ ultima_copia: ahora }).eq('id', 1);
          if (!error) setUltima(ahora);
        }
      }
    } catch (e: any) {
      console.error(e);
      aviso(navigator.onLine ? `${e?.message ?? 'No pude armar la copia'} 😢 Intenta de nuevo.` : 'No hay conexión para armar la copia 📡', 'error');
    } finally {
      setProgreso(null);
    }
  };

  const pct = progreso?.total ? Math.round(((progreso.hechas ?? 0) / progreso.total) * 100) : null;

  return (
    <div id="copia" className="card p-4 flex flex-col gap-3 mt-4 scroll-mt-6">
      <div className="flex items-center gap-3">
        <IconoDescarga className="w-7 h-7 text-bosque shrink-0" />
        <div className="flex-1">
          <p className="font-bold leading-tight">Copia de nuestros recuerdos</p>
          <p className="text-sm text-salvia">Un archivo .zip con las fotos, los audios, las notas, las respuestas y las cartas abiertas, que se puede abrir sin la app.</p>
          {esAdmin && ultima !== undefined && (
            <p className={`text-sm font-bold mt-1 ${diasSinCopia(ultima) === null || diasSinCopia(ultima)! >= DIAS_ENTRE_COPIAS ? 'text-coral' : 'text-bosque'}`}>{textoUltimaCopia(ultima)}</p>
          )}
        </div>
      </div>
      {progreso ? (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <p className="text-sm font-bold text-bosque">{progreso.paso}{progreso.total ? ` ${progreso.hechas}/${progreso.total}` : ''}</p>
          <div className="h-2 rounded-full bg-menta overflow-hidden">
            <div className="h-full rounded-full bg-esmeralda transition-all" style={{ width: `${pct ?? 15}%` }} />
          </div>
          <p className="text-sm text-salvia">No cierres la app mientras tanto.</p>
        </div>
      ) : (
        <button onClick={descargar} className="btn-soft">Descargar copia</button>
      )}
    </div>
  );
}
