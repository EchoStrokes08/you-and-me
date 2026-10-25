// La tarjeta de una cita en el tablero: estado, fecha, lugar, hora y el clima pronosticado para ese día.
// El botón de calendario va directo a Google en Android; en el resto ofrece también el archivo .ics.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fechaBonita, diasEntre, nombreLugar, linkMapa, puedeEditar, horaBonita } from '../../lib/utils';
import { climaPara, cieloDe, NOMBRE_CIELO, type Cielo, type Clima } from '../../lib/lugares/clima';
import { eventoDeCita, linkGoogle, linkIcs } from '../../lib/calendario';
import type { CitaConFecha, EstadoCita } from '../../lib/tipos';
import { IconoCalendario, IconoCamara, IconoCheck, IconoGota, IconoLapiz, IconoLluvia, IconoNiebla, IconoPin, IconoPlan, IconoRegalo, IconoSol, IconoSolNube, IconoTormenta } from '../ui';

const ICONO_CIELO: Record<Cielo, typeof IconoSol> = { sol: IconoSol, nubes: IconoSolNube, niebla: IconoNiebla, lluvia: IconoLluvia, tormenta: IconoTormenta };

// Clima donde es la cita (lugar del mapa o del catálogo); si no se sabe, Bogotá
function Clima({ c }: { c: CitaConFecha }) {
  const [clima, setClima] = useState<Clima | null>(null);
  const lat = c.lugar_lat ?? c.lugares?.lat, lng = c.lugar_lng ?? c.lugares?.lng;
  const conLugar = lat != null && lng != null;
  useEffect(() => {
    const d = diasEntre(c.fecha);
    // Open-Meteo pronostica hasta 16 días
    if (d >= 0 && d <= 15) climaPara(c.fecha, conLugar ? lat : undefined, conLugar ? lng : undefined, c.hora_confirmada).then(setClima);
  }, [c.fecha, c.hora_confirmada, lat, lng, conLugar]);
  if (!clima) return null;
  const cielo = cieloDe(clima.code);
  const Icono = ICONO_CIELO[cielo];
  const llueve = clima.lluvia != null && clima.lluvia >= 40;
  return (
    <span className="badge bg-espuma text-oceano min-h-11 px-3 text-sm gap-1.5 tabular-nums">
      <Icono className="w-[18px] h-[18px]" /><span className="sr-only">{NOMBRE_CIELO[cielo]},</span>
      {clima.temp}°C{c.hora_confirmada ? ` a las ${horaBonita(c.hora_confirmada)}` : ''}{conLugar ? '' : ' en Bogotá'}
      {llueve && <><span aria-hidden="true" className="opacity-50">·</span><IconoGota className="w-4 h-4" /><span className="sr-only">probabilidad de lluvia</span>{clima.lluvia}%</>}
    </span>
  );
}

function Calendario({ c, ocultarSorpresa }: { c: CitaConFecha; ocultarSorpresa: boolean }) {
  const e = eventoDeCita(c, ocultarSorpresa);
  // En Android el calendario es el de Google: el .ics solo estorba
  if (/android/i.test(navigator.userAgent)) {
    return <a href={linkGoogle(e)} target="_blank" rel="noreferrer" className="chip text-sm"><IconoCalendario className="w-4 h-4" /> Google Calendar</a>;
  }
  // Las dos opciones en una sola pastilla: así no ocupan dos renglones
  return (
    <div className="chip text-sm p-0 gap-0 overflow-hidden" role="group" aria-label="Agregar al calendario">
      <span className="pl-3.5 pr-1 text-salvia" aria-hidden="true"><IconoCalendario className="w-4 h-4" /></span>
      <a href={linkGoogle(e)} target="_blank" rel="noreferrer" aria-label="Agregar a Google Calendar" className="self-stretch flex items-center px-2.5 hover:bg-seleccion focus-visible:outline-offset-[-3px]">Google</a>
      <span className="w-px self-stretch my-2.5 bg-menta" aria-hidden="true" />
      <a href={linkIcs(e)} aria-label="Agregar al calendario del iPhone o a Outlook" className="self-stretch flex items-center pl-2.5 pr-3.5 hover:bg-seleccion focus-visible:outline-offset-[-3px]">iPhone / Outlook</a>
    </div>
  );
}

const estadoUI: Record<EstadoCita, { txt: string; cls: string }> = {
  confirmada: { txt: 'Confirmada', cls: 'bg-seleccion text-bosque' },
  pendiente: { txt: 'Por confirmar', cls: 'bg-durazno/35 text-coral' },
  vivida: { txt: 'Vivida', cls: 'bg-menta text-bosque' },
  cancelada: { txt: 'Cancelada', cls: 'bg-crema text-salvia' },
};

// Quién la mira: en Citas, uno mismo; en el panel, el otro (para ver cómo le queda)
export type Mirada = { id: string; rol: 'admin' | 'pareja'; esAdmin: boolean };

export default function TarjetaCita({ c, perfil, pasada, onEditar, onCancelar, onResponder, onVivida }: {
  c: CitaConFecha; perfil: Mirada | null; pasada: boolean;
  onEditar: () => void; onCancelar: () => void; onResponder: (acepta: boolean) => void; onVivida: () => void;
}) {
  const e = estadoUI[c.estado as EstadoCita] ?? estadoUI.cancelada;
  const d = new Date(c.fecha + 'T00:00:00');
  const mapa = linkMapa(c);
  return (
    <div className={`card p-4 flex flex-col gap-3 ${pasada ? 'border-durazno/60' : ''}`}>
      <div className="flex gap-3">
        <div className="shrink-0 self-start w-14 text-center rounded-2xl bg-seleccion py-2">
          <p className="text-xs font-extrabold uppercase text-salvia">{d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')}</p>
          <p className="font-titulo text-2xl font-bold text-bosque leading-none tabular-nums">{d.getDate()}</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-titulo text-xl font-semibold leading-tight break-words">
            {c.es_cita_sorpresa
              ? <><IconoRegalo className="inline-block w-5 h-5 -mt-1 mr-1 text-bosque" />Cita sorpresa</>
              : <>{c.categorias_cita?.emoji && <span className="inline-block align-[-0.15em] mr-1.5 text-bosque" title={c.categorias_cita?.nombre}><IconoPlan emoji={c.categorias_cita.emoji} className="w-5 h-5" /></span>}{nombreLugar(c) ?? ''}</>}
          </p>
          <p className="text-sm text-bosque font-bold mt-0.5">{[c.actividades?.nombre, c.franjas?.nombre].filter(Boolean).join(' · ')}</p>
          <p className="text-sm text-salvia first-letter:uppercase">{fechaBonita(c.fecha)}{c.hora_confirmada ? `, ${horaBonita(c.hora_confirmada)}` : ''}</p>
          <span className={`badge mt-2 ${pasada ? 'bg-durazno/35 text-coral' : e.cls}`}>{pasada ? 'Ya pasó · falta guardarla' : c.estado === 'pendiente' && c.creada_por !== perfil?.id ? 'Te invitó' : c.modificada && c.estado === 'pendiente' ? 'Cambio por confirmar' : c.modificada && c.estado === 'confirmada' ? 'Confirmada · actualizada' : e.txt}</span>
        </div>
      </div>
      {c.nota_admin && <p className="font-titulo italic bg-crema rounded-2xl px-3 py-2 border border-menta break-words">“{c.nota_admin}”</p>}
      {/* Lo que se puede hacer con la cita va a todo el ancho: así los botones no se apilan de a uno */}
      {pasada && (
        <div className="flex flex-wrap gap-2">
          {!c.recuerdos?.length && <Link to="/historia" state={{ cita: c.id }} className="btn-primary text-sm"><IconoCamara className="w-4 h-4" /> Guardar recuerdo</Link>}
          <button onClick={onVivida} className="btn-soft text-sm"><IconoCheck /> Ya la vivimos</button>
        </div>
      )}
      {c.estado === 'confirmada' && !pasada && (
        <div className="flex flex-wrap gap-2">
          <Clima c={c} />
          {mapa && <a href={mapa} target="_blank" rel="noreferrer" className="chip text-sm"><IconoPin className="w-4 h-4" /> Cómo llegar</a>}
          <Calendario c={c} ocultarSorpresa={!perfil?.esAdmin} />
        </div>
      )}
      <div className="flex flex-wrap gap-2 empty:hidden">
        {puedeEditar(c, perfil) && !pasada && (
          <button onClick={onEditar} className="btn-soft text-sm"><IconoLapiz className="w-4 h-4" /> Modificar</button>
        )}
        {c.estado === 'pendiente' && perfil?.rol === 'pareja' && c.creada_por === perfil.id && (
          <button onClick={onCancelar} className="btn-soft text-sm text-coral">Cancelar</button>
        )}
        {c.estado === 'pendiente' && perfil?.rol === 'pareja' && c.creada_por !== perfil.id && (
          <>
            <button onClick={() => onResponder(true)} className="btn-primary text-sm">Aceptar</button>
            <button onClick={() => onResponder(false)} className="btn-soft text-sm text-coral">No puedo</button>
          </>
        )}
      </div>
    </div>
  );
}
