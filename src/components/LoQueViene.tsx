import { Link } from 'react-router-dom';
import { diasEntre, fechaBonita, horaBonita, nombreLugar } from '../lib/utils';
import { proximaFechaEspecial } from './ProximaFecha';
import { Corazon, IconoCalendario, IconoDestello, IconoFlecha, IconoPin, IconoRegalo } from './ui';

// El emoji de la fecha especial viene de ProximaFecha; aquí se dibuja con el juego de iconos
const iconoFecha = (emoji: string) => emoji === '🎂' ? <IconoRegalo className="w-7 h-7" /> : emoji === '🎉' ? <IconoDestello className="w-7 h-7" /> : <Corazon className="w-7 h-7" />;

// En el inicio: la próxima cita y la próxima fecha especial, en una sola tarjeta
export default function LoQueViene({ cita, config, esAdmin }: { cita: any; config: any; esAdmin: boolean }) {
  const fecha = config ? proximaFechaEspecial(config, esAdmin) : undefined;
  const faltan = cita ? diasEntre(cita.fecha) : null;

  return (
    <section className="card p-0 overflow-hidden" aria-label="Lo que viene">
      {cita ? (
        <Link to="/citas" className="flex gap-4 items-center p-4">
          <div className="shrink-0 w-16 h-[72px] rounded-2xl bg-hondo text-white flex flex-col items-center justify-center">
            {faltan === 0 ? (
              <span className="font-titulo text-xl font-bold">hoy</span>
            ) : (
              <>
                <span className="text-xs font-bold">faltan</span>
                <span className="font-titulo text-[1.7rem] font-bold leading-none tabular-nums">{faltan}</span>
                <span className="text-xs font-bold">{faltan === 1 ? 'día' : 'días'}</span>
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-titulo text-lg font-semibold leading-tight truncate">{cita.lugares?.emoji ?? (cita.lugar_personalizado ? <IconoPin className="inline-block w-[18px] h-[18px] -mt-1 text-bosque" /> : '')} {nombreLugar(cita) ?? 'Sorpresa'}</p>
            <p className="text-sm text-salvia mt-0.5">Nuestra próxima cita</p>
            <p className="text-sm text-salvia first-letter:uppercase">
              {fechaBonita(cita.fecha).replace(/ de \d{4}$/, '')}
              {cita.franjas?.nombre && ` · ${cita.franjas.nombre}`}{cita.hora_confirmada && ` · ${horaBonita(cita.hora_confirmada)}`}
            </p>
            {cita.actividades?.nombre && <p className="text-sm font-bold text-bosque truncate">{cita.actividades.nombre}</p>}
          </div>
          <IconoFlecha className="w-4 h-4 text-salvia shrink-0" />
        </Link>
      ) : (
        <Link to="/citas" className="flex gap-4 items-center p-4 group">
          <span className="shrink-0 w-16 h-16 rounded-2xl bg-seleccion text-bosque flex items-center justify-center"><IconoCalendario className="w-7 h-7" /></span>
          <div className="flex-1">
            <p className="font-titulo text-lg font-semibold leading-tight">Aún no hay próxima cita</p>
            <p className="text-sm font-bold text-bosque mt-0.5">Toca para planear una</p>
          </div>
          <IconoFlecha className="w-4 h-4 text-bosque shrink-0 transition-transform group-active:translate-x-1" />
        </Link>
      )}

      {fecha && (
        // Alineada con la fila de la cita: mismo ancho de ícono y mismos márgenes
        <div className={`flex items-center gap-4 p-4 border-t border-menta ${fecha.dias === 0 ? 'bg-seleccion' : 'bg-crema/50'}`}>
          <span className="shrink-0 w-16 h-16 rounded-2xl bg-tarjeta border border-menta text-bosque flex items-center justify-center">{iconoFecha(fecha.emoji)}</span>
          <div className="flex-1 min-w-0">
            <p className="font-titulo text-lg font-semibold leading-tight text-bosque-oscuro first-letter:uppercase">{fecha.texto}</p>
            <p className="text-sm text-salvia mt-0.5 first-letter:uppercase">{fecha.dias === 0 ? '¡Es hoy!' : fechaBonita(fecha.fecha).replace(/ de \d{4}$/, '')}</p>
          </div>
          <div className="shrink-0 text-center text-bosque min-w-12">
            {fecha.dias === 0 ? (
              <IconoDestello className="w-7 h-7 mx-auto" />
            ) : fecha.dias === 1 ? (
              <span className="text-sm font-extrabold">mañana</span>
            ) : (
              <>
                <span className="block font-titulo text-[1.7rem] font-bold leading-none tabular-nums">{fecha.dias}</span>
                <span className="text-xs font-bold text-salvia">días</span>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
