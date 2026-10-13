import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fechaBonita, diasEntre, nombreLugar, linkMapa, puedeEditar, horaBonita } from '../lib/utils';
import { climaPara, climaEmoji, type Clima } from '../lib/clima';
import { eventoDeCita, linkGoogle, linkIcs } from '../lib/calendario';
import { IconoCalendario, IconoCamara, IconoCheck, IconoLapiz, IconoPin, IconoRegalo } from './ui';

// Clima donde es la cita (lugar del mapa o del catálogo); si no se sabe, Bogotá
function Clima({ c }: { c: any }) {
  const [clima, setClima] = useState<Clima | null>(null);
  const lat = c.lugar_lat ?? c.lugares?.lat, lng = c.lugar_lng ?? c.lugares?.lng;
  const conLugar = lat != null && lng != null;
  useEffect(() => {
    const d = diasEntre(c.fecha);
    // Open-Meteo pronostica hasta 16 días
    if (d >= 0 && d <= 15) climaPara(c.fecha, conLugar ? lat : undefined, conLugar ? lng : undefined, c.hora_confirmada).then(setClima);
  }, [c.fecha, c.hora_confirmada, lat, lng, conLugar]);
  if (!clima) return null;
  return (
    <span className="badge bg-espuma text-oceano min-h-11 px-3 text-sm">
      {climaEmoji(clima.code)} {clima.temp}°C{c.hora_confirmada ? ` a las ${horaBonita(c.hora_confirmada)}` : ''}{conLugar ? '' : ' en Bogotá'}
      {clima.lluvia != null && clima.lluvia >= 40 ? ` · ☔ ${clima.lluvia}%` : ''}
    </span>
  );
}

function Calendario({ c, ocultarSorpresa }: { c: any; ocultarSorpresa: boolean }) {
  const e = eventoDeCita(c, ocultarSorpresa);
  return (
    <>
      <a href={linkGoogle(e)} target="_blank" rel="noreferrer" className="chip text-sm"><IconoCalendario className="w-4 h-4" /> Google Calendar</a>
      {/* En Android el calendario es el de Google: el .ics solo estorba */}
      {!/android/i.test(navigator.userAgent) && <a href={linkIcs(e)} className="chip text-sm"><IconoCalendario className="w-4 h-4" /> iPhone / Outlook</a>}
    </>
  );
}

const estadoUI: Record<string, { txt: string; cls: string }> = {
  confirmada: { txt: 'Confirmada', cls: 'bg-seleccion text-bosque' },
  pendiente: { txt: 'Por confirmar', cls: 'bg-durazno/35 text-coral' },
  vivida: { txt: 'Vivida', cls: 'bg-menta text-bosque' },
  cancelada: { txt: 'Cancelada', cls: 'bg-crema text-salvia' },
};

// Quién la mira: en Citas, uno mismo; en el panel, el otro (para ver cómo le queda)
export type Mirada = { id: string; rol: 'admin' | 'pareja'; esAdmin: boolean };

export default function TarjetaCita({ c, perfil, pasada, onEditar, onCancelar, onResponder, onVivida }: {
  c: any; perfil: Mirada | null; pasada: boolean;
  onEditar: () => void; onCancelar: () => void; onResponder: (acepta: boolean) => void; onVivida: () => void;
}) {
  const e = estadoUI[c.estado] ?? estadoUI.cancelada;
  const d = new Date(c.fecha + 'T00:00:00');
  return (
    <div className={`card p-4 flex gap-3 ${pasada ? 'border-durazno/60' : ''}`}>
      <div className="shrink-0 self-start w-14 text-center rounded-2xl bg-seleccion py-2">
        <p className="text-xs font-extrabold uppercase text-salvia">{d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')}</p>
        <p className="font-titulo text-2xl font-bold text-bosque leading-none">{d.getDate()}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-titulo text-xl font-semibold leading-tight">
          {c.es_cita_sorpresa ? <><IconoRegalo className="inline-block w-5 h-5 -mt-1 text-bosque" /> Cita sorpresa</> : `${c.categorias_cita?.emoji ?? ''} ${nombreLugar(c) ?? ''}`}
        </p>
        <p className="text-sm text-bosque font-bold mt-0.5">{[c.actividades?.nombre, c.franjas?.nombre].filter(Boolean).join(' · ')}</p>
        <p className="text-sm text-salvia first-letter:uppercase">{fechaBonita(c.fecha)}{c.hora_confirmada ? `, ${horaBonita(c.hora_confirmada)}` : ''}</p>
        <span className={`badge mt-2 ${pasada ? 'bg-durazno/35 text-coral' : e.cls}`}>{pasada ? 'Ya pasó · falta guardarla' : c.estado === 'pendiente' && c.creada_por !== perfil?.id ? 'Te invitó' : c.modificada && c.estado === 'pendiente' ? 'Cambio por confirmar' : c.modificada && c.estado === 'confirmada' ? 'Confirmada · actualizada' : e.txt}</span>
        {c.nota_admin && <p className="font-titulo italic mt-2 bg-crema rounded-2xl px-3 py-2 border border-menta">“{c.nota_admin}”</p>}
        {pasada && (
          <div className="flex flex-wrap gap-2 mt-3">
            {!c.recuerdos?.length && <Link to="/historia" state={{ cita: c.id }} className="btn-primary text-sm"><IconoCamara className="w-4 h-4" /> Guardar recuerdo</Link>}
            <button onClick={onVivida} className="btn-soft text-sm"><IconoCheck /> Ya la vivimos</button>
          </div>
        )}
        {c.estado === 'confirmada' && !pasada && (
          <div className="flex flex-wrap gap-2 mt-3">
            <Clima c={c} />
            {linkMapa(c) && <a href={linkMapa(c)!} target="_blank" rel="noreferrer" className="chip text-sm"><IconoPin className="w-4 h-4" /> Cómo llegar</a>}
            <Calendario c={c} ocultarSorpresa={!perfil?.esAdmin} />
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-3 empty:hidden">
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
    </div>
  );
}
