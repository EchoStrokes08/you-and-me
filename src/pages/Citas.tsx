import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fechaBonita, diasEntre, hoyStr, nombreLugar, linkMapa, puedeEditar, horaBonita } from '../lib/utils';
import { climaPara, climaEmoji, type Clima } from '../lib/clima';
import { eventoDeCita, linkGoogle, linkIcs } from '../lib/calendario';
import CitaWizard from '../components/CitaWizard';
import EditarCita from '../components/EditarCita';
import { AnimatePresence } from 'framer-motion';
import Ballena from '../components/Ballena';
import { Encabezado, Segmented, Vacio } from '../components/ui';
import { useAvisos } from '../lib/avisos';

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
    <span className="badge bg-espuma text-oceano">
      {climaEmoji(clima.code)} {clima.temp}°C{c.hora_confirmada ? ` a las ${horaBonita(c.hora_confirmada)}` : ''}{conLugar ? '' : ' en Bogotá'}
      {clima.lluvia != null && clima.lluvia >= 40 ? ` · ☔ ${clima.lluvia}%` : ''}
    </span>
  );
}

function Calendario({ c, ocultarSorpresa }: { c: any; ocultarSorpresa: boolean }) {
  const e = eventoDeCita(c, ocultarSorpresa);
  return (
    <>
      <a href={linkGoogle(e)} target="_blank" rel="noreferrer" className="badge bg-seleccion text-bosque border border-menta">+ Google Calendar</a>
      {/* En Android el calendario es el de Google: el .ics solo estorba */}
      {!/android/i.test(navigator.userAgent) && <a href={linkIcs(e)} className="badge bg-seleccion text-bosque border border-menta">📅 iPhone / Outlook</a>}
    </>
  );
}

const VIVIDAS_POR_PAGINA = 15;

const estadoUI: Record<string, { txt: string; cls: string; barra: string }> = {
  confirmada: { txt: 'Confirmada ✓', cls: 'bg-seleccion text-bosque', barra: 'bg-esmeralda' },
  pendiente: { txt: 'Por confirmar', cls: 'bg-durazno/35 text-coral', barra: 'bg-durazno' },
  vivida: { txt: 'Vivida 💚', cls: 'bg-menta text-bosque', barra: 'bg-salvia' },
  cancelada: { txt: 'Cancelada', cls: 'bg-crema text-salvia', barra: 'bg-menta' },
};

export default function Citas() {
  const { perfil } = useAuth();
  const { revisar, confirmar } = useAvisos();
  const [tab, setTabEstado] = useState<'proximas' | 'confirmar' | 'vividas'>('proximas');
  const [limite, setLimite] = useState(VIVIDAS_POR_PAGINA);
  const setTab = (t: typeof tab) => { setTabEstado(t); setLimite(VIVIDAS_POR_PAGINA); };
  const [citas, setCitas] = useState<any[]>([]);
  const [wizard, setWizard] = useState(false);
  const [editando, setEditando] = useState<any>(null);

  const cargar = async () => {
    const { data } = await supabase
      .from('citas')
      .select('*, lugares(nombre,emoji,lat,lng), actividades(nombre), franjas(nombre), categorias_cita(nombre,emoji)')
      .order('fecha');
    setCitas(data ?? []);
  };
  useEffect(() => {
    cargar();
    const ch = supabase.channel('citas-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, () => cargar()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const cancelar = async (id: string) => {
    if (!(await confirmar({ titulo: '¿Cancelar esta cita?', boton: 'Cancelar cita', peligro: true }))) return;
    revisar(await supabase.from('citas').update({ estado: 'cancelada' }).eq('id', id), 'No pude cancelar la cita');
    cargar();
  };

  const filtradas = citas.filter((c) => {
    if (tab === 'proximas') return c.estado === 'confirmada' && c.fecha >= hoyStr();
    if (tab === 'confirmar') return c.estado === 'pendiente';
    return c.estado === 'vivida';
  });
  // Las vividas, de la más reciente a la más vieja y por partes
  const lista = tab === 'vividas' ? [...filtradas].reverse().slice(0, limite) : filtradas;
  const faltan = filtradas.length - lista.length;

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Encabezado eyebrow="Tú y yo, en el calendario" titulo="Citas" />

      <button onClick={() => setWizard(true)} className="card-hero text-left active:scale-[0.98] transition-transform">
        <p className="eyebrow text-lima">Nueva aventura</p>
        <p className="font-titulo text-2xl font-bold mt-1 max-w-[60%] leading-tight">Planear una cita ✨</p>
        <p className="text-sm text-white/80 mt-1 max-w-[60%]">Escoge el plan, el lugar y el día; yo me encargo del resto.</p>
        <Ballena className="absolute -right-3 bottom-1 w-36 drop-shadow-lg" color="#CFE9E4" panza="#FFFFFF" />
      </button>

      <Segmented id="tabs-citas" value={tab} onChange={setTab} options={[['proximas', 'Próximas'], ['confirmar', 'Por confirmar'], ['vividas', 'Vividas']] as const} />

      <div className="flex flex-col gap-3 stagger" key={tab}>
        {filtradas.length === 0 && <Vacio titulo="Aún no hay nada aquí" texto="Las ballenas esperan su próxima aventura juntas 🌊" />}
        {lista.map((c) => {
          const e = estadoUI[c.estado] ?? estadoUI.cancelada;
          const d = new Date(c.fecha + 'T00:00:00');
          return (
            <div key={c.id} className="card p-0 overflow-hidden flex">
              <span className={`w-1.5 shrink-0 ${e.barra}`} />
              <div className="flex gap-3 p-4 flex-1 min-w-0">
                <div className="shrink-0 w-14 text-center rounded-2xl bg-seleccion border border-menta py-2">
                  <p className="text-[10px] font-extrabold uppercase text-salvia">{d.toLocaleDateString('es-CO', { month: 'short' })}</p>
                  <p className="font-titulo text-2xl font-bold text-bosque leading-none">{d.getDate()}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-bold leading-tight">{c.es_cita_sorpresa ? '🎁 Cita sorpresa' : `${c.categorias_cita?.emoji ?? ''} ${nombreLugar(c) ?? ''}`}</p>
                    <span className={`badge shrink-0 ${e.cls}`}>{c.modificada && c.estado === 'pendiente' ? 'Cambio por confirmar' : e.txt}</span>
                  </div>
                  <p className="text-sm text-bosque font-semibold">{[c.actividades?.nombre, c.franjas?.nombre].filter(Boolean).join(' · ')}</p>
                  <p className="text-xs capitalize text-salvia">{fechaBonita(c.fecha)} {c.hora_confirmada ? `a las ${horaBonita(c.hora_confirmada)}` : ''}</p>
                  {c.nota_admin && <p className="text-sm italic mt-2 bg-crema rounded-xl px-3 py-2 border border-menta">"{c.nota_admin}"</p>}
                  {c.estado === 'confirmada' && (
                    <div className="flex flex-wrap gap-2 mt-2"><Clima c={c} /><Calendario c={c} ocultarSorpresa={perfil?.rol !== 'admin'} />{linkMapa(c) && <a href={linkMapa(c)!} target="_blank" rel="noreferrer" className="badge bg-seleccion text-bosque border border-menta">📍 Cómo llegar</a>}</div>
                  )}
                  {c.modificada && c.estado === 'confirmada' && <p className="text-xs font-bold text-esmeralda mt-1">✏️ Actualizada después de confirmar</p>}
                  <div className="flex gap-4 mt-2">
                    {puedeEditar(c, perfil) && (
                      <button onClick={() => setEditando(c)} className="text-sm text-bosque font-bold">✏️ Modificar</button>
                    )}
                    {c.estado === 'pendiente' && perfil?.rol === 'pareja' && (
                      <button onClick={() => cancelar(c.id)} className="text-sm text-coral font-bold">Cancelar</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {faltan > 0 && (
          <button onClick={() => setLimite(limite + VIVIDAS_POR_PAGINA)} className="btn-soft">Ver más citas vividas ({faltan})</button>
        )}
      </div>

      {wizard && <CitaWizard onClose={() => { setWizard(false); cargar(); }} />}
      <AnimatePresence>
        {editando && <EditarCita cita={editando} onClose={() => setEditando(null)} onSaved={cargar} />}
      </AnimatePresence>
    </div>
  );
}
