// El mes para escoger el día de una cita; lo usan el asistente de citas y la edición de una.
// Los días bloqueados por quien convoca quedan tachados y no se dejan escoger; el día de hoy lleva su puntito.
import { useState } from 'react';
import { fechaStr, hoy } from '../lib/utils';
import { IconoAtras, IconoAdelante } from './ui';

/** Un mes para escoger el día de una cita: no se eligen días bloqueados (los avisó quien llama) *
 * y el de hoy queda marcado con un puntito. `mesInicial` corresponde al mes por el que arrancar */
export function Calendario({ onPick, fecha, fechaBloqueada, mesInicial }: { onPick: (s: string) => void; fecha: string; fechaBloqueada: (d: Date) => string | null; mesInicial?: string }) {
  const [base, setBase] = useState(() => { const h = mesInicial ? new Date(mesInicial + 'T00:00:00') : hoy(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const diasMes = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const inicioSemana = base.getDay();
  const hoyS = fechaStr(hoy());
  return (
    <div className="card p-4">
      <div className="flex justify-between items-center mb-3">
        <button className="btn-icon" aria-label="Mes anterior" onClick={() => setBase(new Date(base.getFullYear(), base.getMonth() - 1, 1))}><IconoAtras className="w-4 h-4" /></button>
        <p className="font-titulo text-lg font-semibold first-letter:uppercase">{base.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</p>
        <button className="btn-icon" aria-label="Mes siguiente" onClick={() => setBase(new Date(base.getFullYear(), base.getMonth() + 1, 1))}><IconoAdelante className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-extrabold text-salvia mb-1">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 text-center gap-y-1">
        {Array.from({ length: inicioSemana }).map((_, i) => <span key={'v' + i} />)}
        {Array.from({ length: diasMes }).map((_, i) => {
          const d = new Date(base.getFullYear(), base.getMonth(), i + 1);
          const s = fechaStr(d);
          const bloqueo = fechaBloqueada(d);
          const elegido = fecha === s;
          return (
            <button key={s} disabled={!!bloqueo} title={bloqueo ?? ''} aria-pressed={elegido} onClick={() => onPick(s)}
              className={`relative mx-auto w-full max-w-11 aspect-square rounded-full font-bold transition-colors ${elegido
                ? 'bg-hondo text-white'
                : bloqueo ? 'text-salvia/60 line-through' : 'bg-seleccion text-bosque active:bg-menta'}`}>
              {i + 1}
              {s === hoyS && !elegido && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-alerta" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
