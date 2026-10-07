import { useState } from 'react';
import { armarCopia, entregarArchivo, type Progreso } from '../lib/copia';
import { useAvisos } from '../lib/avisos';
import { hoyStr } from '../lib/utils';

// Botón al final de Historia: descarga un ZIP con los recuerdos, fotos y cartas
export default function CopiaSeguridad() {
  const { aviso } = useAvisos();
  const [progreso, setProgreso] = useState<Progreso | null>(null);

  const descargar = async () => {
    setProgreso({ paso: 'Empezando…' });
    try {
      const blob = await armarCopia(setProgreso);
      const r = await entregarArchivo(blob, `you-and-me-copia-${hoyStr()}.zip`);
      if (r !== 'cancelado') aviso(r === 'compartido' ? 'Copia lista 💾 Guárdala en Archivos' : 'Copia descargada 💾');
    } catch (e: any) {
      console.error(e);
      aviso(navigator.onLine ? `${e?.message ?? 'No pude armar la copia'} 😢 Intenta de nuevo.` : 'No hay conexión para armar la copia 📡', 'error');
    } finally {
      setProgreso(null);
    }
  };

  const pct = progreso?.total ? Math.round(((progreso.hechas ?? 0) / progreso.total) * 100) : null;

  return (
    <div className="card p-4 flex flex-col gap-3 mt-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl">💾</span>
        <div className="flex-1">
          <p className="font-bold leading-tight">Copia de nuestros recuerdos</p>
          <p className="text-xs text-salvia">Un archivo .zip con las fotos, las notas, las respuestas y las cartas abiertas, que se puede abrir sin la app.</p>
        </div>
      </div>
      {progreso ? (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <p className="text-sm font-bold text-bosque">{progreso.paso}{progreso.total ? ` ${progreso.hechas}/${progreso.total}` : ''}</p>
          <div className="h-2 rounded-full bg-menta overflow-hidden">
            <div className="h-full rounded-full bg-esmeralda transition-all" style={{ width: `${pct ?? 15}%` }} />
          </div>
          <p className="text-xs text-salvia">No cierres la app mientras tanto.</p>
        </div>
      ) : (
        <button onClick={descargar} className="btn-soft">Descargar copia</button>
      )}
    </div>
  );
}
