import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fechaBonita, fechaStr, hoy } from '../lib/utils';
import { Hoja, IconoAdelante, IconoAtras } from './ui';

type Fila = { usuario_id: string; fecha: string; emoji: string; etiqueta: string };

// El ánimo de los dos, día por día, en el mes: arriba el mío y abajo el del otro
export default function HistorialAnimo({ abierta, onClose, yo, pareja }: { abierta: boolean; onClose: () => void; yo: string; pareja: string }) {
  const [base, setBase] = useState(() => { const h = hoy(); return new Date(h.getFullYear(), h.getMonth(), 1); });
  const [filas, setFilas] = useState<Fila[] | null>(null);

  const diasMes = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const desde = fechaStr(base);
  const hasta = fechaStr(new Date(base.getFullYear(), base.getMonth(), diasMes));
  const esMesActual = desde === fechaStr(new Date(hoy().getFullYear(), hoy().getMonth(), 1));

  useEffect(() => {
    if (!abierta) return;
    let vigente = true;
    setFilas(null);
    supabase.from('estados_animo').select('usuario_id, fecha, emoji, etiqueta').gte('fecha', desde).lte('fecha', hasta)
      .then(({ data }) => { if (vigente) setFilas(data ?? []); });
    return () => { vigente = false; };
  }, [abierta, desde, hasta]);

  // Lo que más sintió cada uno en el mes
  const masFrecuente = (mio: boolean) => {
    const conteo = new Map<string, { emoji: string; etiqueta: string; n: number }>();
    for (const f of filas ?? []) {
      if ((f.usuario_id === yo) !== mio) continue;
      const c = conteo.get(f.etiqueta) ?? { emoji: f.emoji, etiqueta: f.etiqueta, n: 0 };
      c.n++;
      conteo.set(f.etiqueta, c);
    }
    return [...conteo.values()].sort((a, b) => b.n - a.n)[0];
  };
  const resumen = [['Tú', masFrecuente(true)], [pareja, masFrecuente(false)]] as const;

  return (
    <Hoja abierta={abierta} onClose={onClose} titulo="Cómo nos hemos sentido">
      <div className="flex justify-between items-center -mb-2">
        <button className="btn-icon" aria-label="Mes anterior" onClick={() => setBase(new Date(base.getFullYear(), base.getMonth() - 1, 1))}><IconoAtras className="w-4 h-4" /></button>
        <p className="font-titulo text-lg font-semibold first-letter:uppercase">{base.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</p>
        <button className="btn-icon disabled:opacity-40" aria-label="Mes siguiente" disabled={esMesActual} onClick={() => setBase(new Date(base.getFullYear(), base.getMonth() + 1, 1))}><IconoAdelante className="w-4 h-4" /></button>
      </div>

      <div>
        <div className="grid grid-cols-7 text-center text-xs font-extrabold text-salvia mb-1" aria-hidden="true">
          {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1" aria-busy={filas === null}>
          {Array.from({ length: base.getDay() }).map((_, i) => <span key={'v' + i} />)}
          {Array.from({ length: diasMes }).map((_, i) => {
            const s = fechaStr(new Date(base.getFullYear(), base.getMonth(), i + 1));
            const mio = filas?.find((f) => f.fecha === s && f.usuario_id === yo);
            const suyo = filas?.find((f) => f.fecha === s && f.usuario_id !== yo);
            const hay = mio || suyo;
            return (
              <div key={s} role="img"
                aria-label={`${fechaBonita(s)}: ${hay ? [mio && `tú, ${mio.etiqueta}`, suyo && `${pareja}, ${suyo.etiqueta}`].filter(Boolean).join('; ') : 'sin registro'}`}
                className={`min-h-[4.25rem] rounded-xl flex flex-col items-center justify-start pt-1 gap-0.5 ${hay ? 'bg-tarjeta border border-menta' : 'bg-seleccion/50'}`}>
                <span className={`text-xs font-bold leading-none ${hay ? 'text-salvia' : 'text-salvia/70'}`}>{i + 1}</span>
                <span className="text-base leading-none h-4">{mio?.emoji}</span>
                <span className="text-base leading-none h-4">{suyo?.emoji}</span>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-salvia mt-2">En cada día, arriba estás tú y abajo {pareja}.</p>
      </div>

      {filas !== null && (filas.length === 0 ? (
        <p className="text-salvia font-semibold">Este mes ninguno contó cómo se sentía.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {resumen.map(([quien, m]) => (
            <div key={quien} className="card p-3">
              <p className="text-sm font-bold text-salvia">{quien}, casi siempre</p>
              {m ? (
                <>
                  <p className="font-titulo text-lg font-bold text-bosque leading-tight mt-1"><span aria-hidden="true">{m.emoji}</span> {m.etiqueta}</p>
                  <p className="text-sm text-salvia">{m.n} {m.n === 1 ? 'día' : 'días'}</p>
                </>
              ) : <p className="text-sm text-salvia mt-1">Sin registro este mes</p>}
            </div>
          ))}
        </div>
      ))}
    </Hoja>
  );
}
