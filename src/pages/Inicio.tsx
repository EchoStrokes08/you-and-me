import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { diasEntre, fechaStr, hoy, hoyStr, hoyBonito, nombreLugar } from '../lib/utils';
import { Link } from 'react-router-dom';
import Ballena, { Olas, Burbujas } from '../components/Ballena';
import { Contador, IconoAjustes, IconoFlecha } from '../components/ui';
import AvisoNotificaciones from '../components/AvisoNotificaciones';
import PiensoEnTi from '../components/PiensoEnTi';
import EstadoAnimo from '../components/EstadoAnimo';
import LoQueViene from '../components/LoQueViene';
import UnDiaComoHoy from '../components/UnDiaComoHoy';
import Ajustes from '../components/Ajustes';

const desglose = (inicio: string) => {
  const a = new Date(inicio + 'T00:00:00');
  const b = new Date();
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) meses--;
  return { anios: Math.floor(meses / 12), meses: meses % 12 };
};

// Solo se pide guardar como recuerdo las citas de las últimas semanas
const DIAS_PARA_RECUERDO = 30;

const ACCESOS = [
  { to: '/juntos', emoji: '✨', label: 'Por hacer' },
  { to: '/juntos?tab=regalos', emoji: '🎁', label: 'Regalos' },
  { to: '/juntos?tab=canciones', emoji: '🎵', label: 'Canciones' },
  { to: '/cartas', emoji: '💌', label: 'Cartas' },
];

export default function Inicio() {
  const { perfil } = useAuth();
  const [config, setConfig] = useState<any>(null);
  const [proxima, setProxima] = useState<any>(null);
  const [pregunta, setPregunta] = useState<any>(null);
  const [estado, setEstado] = useState<{ yo: boolean; pareja: boolean }>({ yo: false, pareja: false });
  const [sinRecuerdo, setSinRecuerdo] = useState<any>(null);
  const [cartas, setCartas] = useState({ porAbrir: 0, momento: 0 });
  const [racha, setRacha] = useState(0);
  const [ajustes, setAjustes] = useState(false);
  // En diciembre se muestra el año que termina; en enero, el que acaba de terminar
  const [anioResumen] = useState(() => { const d = new Date(); return d.getMonth() === 11 ? d.getFullYear() : d.getMonth() === 0 ? d.getFullYear() - 1 : null; });

  useEffect(() => {
    supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setConfig(data));
    supabase.from('citas').select('*, lugares(nombre,emoji), actividades(nombre), franjas(nombre)').eq('estado', 'confirmada').gte('fecha', hoyStr()).order('fecha').limit(1).maybeSingle().then(({ data }) => setProxima(data));
    // La cita pasada más reciente que todavía no tiene recuerdo
    const desde = hoy();
    desde.setDate(desde.getDate() - DIAS_PARA_RECUERDO);
    supabase.from('citas').select('*, lugares(nombre), recuerdos(id)').eq('estado', 'confirmada').lt('fecha', hoyStr()).gte('fecha', fechaStr(desde))
      .order('fecha', { ascending: false }).limit(5)
      .then(({ data }) => setSinRecuerdo((data ?? []).find((c: any) => !c.recuerdos?.length) ?? null));
    supabase.rpc('obtener_pregunta_del_dia').then(({ data }) => {
      setPregunta(data);
      if (data?.id) supabase.rpc('estado_respuestas', { p_pregunta_id: data.id }).then(({ data: e }) => { if (e?.[0]) setEstado(e[0]); });
    });
    supabase.rpc('racha_preguntas').then(({ data }) => setRacha(data?.[0]?.dias ?? 0));
    supabase.rpc('cartas_recibidas').then(({ data }) => {
      const sinAbrir = (data ?? []).filter((c: any) => !c.abierta_en);
      setCartas({ porAbrir: sinAbrir.filter((c: any) => c.disponible).length, momento: sinAbrir.filter((c: any) => c.momento).length });
    });
  }, []);

  const esAdmin = perfil?.rol === 'admin';
  const diasJuntos = config ? -diasEntre(config.fecha_inicio) : 0;
  const tiempo = config?.fecha_inicio ? desglose(config.fecha_inicio) : null;
  const pareja = (esAdmin ? config?.nombre_ella : config?.nombre_el) ?? (esAdmin ? 'Ella' : 'Él');
  const ambosRespondieron = estado.yo && estado.pareja;

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4 stagger">
      <header className="pt-2 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="eyebrow first-letter:uppercase">{hoyBonito()}</p>
          <h1 className="text-[2.1rem] leading-tight font-bold">Hiii, <span className="italic text-bosque">{config?.apodo_ella ?? 'Ma vie'}</span> 💚</h1>
        </div>
        <button onClick={() => setAjustes(true)} className="btn-icon shrink-0 mt-1" aria-label="Ajustes">
          <IconoAjustes className="w-5 h-5" />
        </button>
      </header>

      {/* Héroe: los días juntos, bajo el mar */}
      <section className="card-hero min-h-[210px]">
        <p className="eyebrow text-lima">Llevamos</p>
        <p className="font-titulo text-7xl font-bold leading-none mt-2 tabular-nums"><Contador valor={diasJuntos} /></p>
        <p className="font-semibold text-white/85 mt-1">días juntos</p>
        {tiempo && (tiempo.anios > 0 || tiempo.meses > 0) && (
          <div className="flex gap-2 mt-4">
            {tiempo.anios > 0 && <span className="badge bg-white/15 text-white backdrop-blur">{tiempo.anios} {tiempo.anios === 1 ? 'año' : 'años'}</span>}
            <span className="badge bg-white/15 text-white backdrop-blur">{tiempo.meses} {tiempo.meses === 1 ? 'mes' : 'meses'}</span>
          </div>
        )}
        <div className="absolute right-2 bottom-7 w-40">
          <Ballena className="w-full drop-shadow-lg" color="#CFE9E4" panza="#FFFFFF" />
          <Burbujas className="absolute w-16 -top-10 left-2" color="#FFFFFF" />
        </div>
        <Olas className="absolute bottom-0 inset-x-0 h-8" color="#CFE9E4" opacidad={0.18} />
        <Olas className="absolute -bottom-1 inset-x-0 h-5" color="#CFE9E4" opacidad={0.28} />
      </section>

      {/* Pendientes: solo aparecen cuando hay algo por hacer (si no hay nada, el bloque no ocupa espacio) */}
      <div className="flex flex-col gap-2 empty:hidden">
        {cartas.porAbrir > 0 && (
          <Link to="/cartas" className="fila-aviso border-esmeralda bg-seleccion">
            <span className="text-xl">💌</span>
            <p className="flex-1 font-bold text-sm text-bosque">Tienes {cartas.porAbrir} {cartas.porAbrir === 1 ? 'carta' : 'cartas'} por abrir ✨</p>
            <IconoFlecha className="w-4 h-4 text-bosque" />
          </Link>
        )}
        {sinRecuerdo && (
          <Link to="/historia" className="fila-aviso bg-durazno/20 border-durazno/50">
            <span className="text-xl">📸</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight">¿Cómo nos fue? Guardémosla como recuerdo</p>
              {nombreLugar(sinRecuerdo) && <p className="text-xs text-salvia truncate">{nombreLugar(sinRecuerdo)}</p>}
            </div>
            <IconoFlecha className="w-4 h-4 text-coral" />
          </Link>
        )}
        {anioResumen && (
          <Link to={`/resumen?anio=${anioResumen}`} className="fila-aviso">
            <span className="text-xl">✨</span>
            <p className="flex-1 font-bold text-sm">Nuestro {anioResumen} en resumen ya está listo</p>
            <IconoFlecha className="w-4 h-4 text-bosque" />
          </Link>
        )}
        <AvisoNotificaciones />
      </div>

      {/* Nosotros hoy: el "pienso en ti" y cómo nos sentimos, juntos en una tarjeta */}
      {perfil && (
        <section className="card flex flex-col gap-4 overflow-hidden" aria-label="Nosotros hoy">
          <PiensoEnTi yo={perfil.id} pareja={pareja} />
          <div className="border-t border-menta -mx-5" />
          <EstadoAnimo yo={perfil.id} pareja={pareja} cartasMomento={cartas.momento} />
        </section>
      )}

      {pregunta && (ambosRespondieron ? (
        <Link to="/preguntas" className="card p-4 flex items-center gap-3">
          <span className="w-11 h-11 shrink-0 rounded-2xl bg-seleccion border border-menta flex items-center justify-center text-xl">💭</span>
          <div className="flex-1 min-w-0">
            <p className="eyebrow">Pregunta del día{racha > 0 && <span className="ml-2 normal-case tracking-normal text-coral">🔥 {racha}</span>}</p>
            <p className="font-bold text-sm leading-tight text-bosque">✓ Los dos respondieron</p>
          </div>
          <IconoFlecha className="w-4 h-4 text-bosque" />
        </Link>
      ) : (
        <Link to="/preguntas" className="card relative overflow-hidden block">
          <span className="absolute right-3 -top-3 text-[96px] font-titulo text-menta/70 leading-none select-none" aria-hidden="true">?</span>
          <p className="eyebrow relative">Pregunta del día 💭{racha > 0 && <span className="ml-2 normal-case tracking-normal text-coral">🔥 {racha} {racha === 1 ? 'día' : 'días'}</span>}</p>
          <p className="font-titulo text-xl font-semibold leading-snug mt-1 relative">{pregunta.texto}</p>
          <div className="flex items-center gap-2 mt-3 relative">
            <span className={`badge ${estado.yo ? 'bg-seleccion text-bosque' : 'bg-durazno/30 text-coral'}`}>
              {estado.yo ? `✓ Ya respondiste · ${pareja} aún no` : estado.pareja ? `✏️ ${pareja} ya respondió, falta la tuya` : '✏️ Falta la tuya'}
            </span>
            <span className="ml-auto text-sm font-extrabold text-bosque flex items-center gap-1">{estado.yo ? 'Ver' : 'Responder'} <IconoFlecha /></span>
          </div>
        </Link>
      ))}

      <LoQueViene cita={proxima} config={config} esAdmin={esAdmin} />

      <UnDiaComoHoy />

      <nav className="grid grid-cols-4 gap-2" aria-label="Accesos">
        {ACCESOS.map((a) => (
          <Link key={a.to} to={a.to} className="acceso">
            <span className="acceso-icono">{a.emoji}</span>
            {a.label}
          </Link>
        ))}
      </nav>

      <Ajustes abierto={ajustes} onClose={() => setAjustes(false)} />
    </div>
  );
}
