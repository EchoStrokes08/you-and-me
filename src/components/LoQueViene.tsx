import { Link } from 'react-router-dom';
import { diasEntre, fechaBonita, horaBonita, nombreLugar } from '../lib/utils';
import { proximaFechaEspecial } from './ProximaFecha';
import { IconoFlecha } from './ui';

// En el inicio: la próxima cita y la próxima fecha especial, en una sola tarjeta
export default function LoQueViene({ cita, config, esAdmin }: { cita: any; config: any; esAdmin: boolean }) {
  const fecha = config ? proximaFechaEspecial(config, esAdmin) : undefined;
  const faltan = cita ? diasEntre(cita.fecha) : null;

  return (
    <section className="card p-0 overflow-hidden" aria-label="Lo que viene">
      {cita ? (
        <Link to="/citas" className="flex gap-4 items-center p-4">
          <div className="shrink-0 w-16 h-[70px] rounded-2xl bg-gradient-to-b from-esmeralda to-hondo text-white flex flex-col items-center justify-center shadow-soft">
            <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">{faltan === 0 ? 'hoy' : 'faltan'}</span>
            <span className="font-titulo text-[1.7rem] font-bold leading-none">{faltan === 0 ? '🎉' : faltan}</span>
            {faltan !== 0 && <span className="text-[10px] font-bold opacity-80">{faltan === 1 ? 'día' : 'días'}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="eyebrow">Próxima cita</p>
            <p className="font-titulo text-lg font-semibold leading-tight truncate">{cita.lugares?.emoji ?? (cita.lugar_personalizado ? '📍' : '')} {nombreLugar(cita) ?? 'Sorpresa'}</p>
            <p className="text-xs text-salvia mt-0.5 first-letter:uppercase">
              {fechaBonita(cita.fecha).replace(/ de \d{4}$/, '')}
              {cita.franjas?.nombre && ` · ${cita.franjas.nombre}`}{cita.hora_confirmada && ` · ${horaBonita(cita.hora_confirmada)}`}
            </p>
            {cita.actividades?.nombre && <p className="text-xs font-bold text-bosque truncate">{cita.actividades.nombre}</p>}
          </div>
          <IconoFlecha className="w-4 h-4 text-salvia shrink-0" />
        </Link>
      ) : (
        <Link to="/citas" className="flex gap-4 items-center p-4 group">
          <span className="shrink-0 w-16 h-16 rounded-2xl bg-seleccion border border-menta flex items-center justify-center text-2xl">💌</span>
          <div className="flex-1">
            <p className="eyebrow">Próxima cita</p>
            <p className="font-titulo text-lg font-semibold leading-tight">Aún no hay ninguna</p>
            <p className="text-xs font-bold text-bosque mt-0.5">Toca para planear una</p>
          </div>
          <IconoFlecha className="w-4 h-4 text-bosque shrink-0 transition-transform group-active:translate-x-1" />
        </Link>
      )}

      {fecha && (
        // Alineada con la fila de la cita: mismo ancho de ícono y mismos márgenes
        <div className={`flex items-center gap-4 p-4 border-t border-menta ${fecha.dias === 0 ? 'bg-seleccion' : 'bg-crema/50'}`}>
          <span className="shrink-0 w-16 h-16 rounded-2xl bg-tarjeta border border-menta flex items-center justify-center text-[1.9rem] shadow-soft">{fecha.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="eyebrow">{fecha.dias === 0 ? '¡Es hoy!' : 'Fecha especial'}</p>
            <p className="font-titulo text-lg font-semibold leading-tight text-bosque-oscuro first-letter:uppercase">{fecha.texto}</p>
            <p className="text-xs text-salvia mt-0.5 first-letter:uppercase">{fechaBonita(fecha.fecha).replace(/ de \d{4}$/, '')}</p>
          </div>
          <div className="shrink-0 text-center text-bosque min-w-12">
            {fecha.dias === 0 ? (
              <span className="text-2xl">🎉</span>
            ) : fecha.dias === 1 ? (
              <span className="text-sm font-extrabold">mañana</span>
            ) : (
              <>
                <span className="block font-titulo text-[1.7rem] font-bold leading-none tabular-nums">{fecha.dias}</span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-salvia">días</span>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
