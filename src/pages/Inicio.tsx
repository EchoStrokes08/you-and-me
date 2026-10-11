import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { diasEntre, fechaStr, hoy, hoyStr, hoyBonito, nombreLugar } from '../lib/utils';
import { Link } from 'react-router-dom';
import Ballena, { Mar, Olas } from '../components/Ballena';
import { Contador, Corazon, IconoCamara, IconoCheck, IconoDeslizadores, IconoDestello, IconoFlecha, IconoFuego, IconoLista, IconoMusica, IconoRegalo, SolapaSobre } from '../components/ui';
import { usePendientes } from '../lib/pendientes';
import AvisoNotificaciones from '../components/AvisoNotificaciones';
import PiensoEnTi from '../components/PiensoEnTi';
import EstadoAnimo from '../components/EstadoAnimo';
import LoQueViene from '../components/LoQueViene';
import UnDiaComoHoy from '../components/UnDiaComoHoy';
import Ajustes from '../components/Ajustes';
import AvisoFlores from '../especiales/flores/AvisoFlores'; // flores (temporal)

const desglose = (inicio: string) => {
  const a = new Date(inicio + 'T00:00:00');
  const b = new Date();
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) meses--;
  return { anios: Math.floor(meses / 12), meses: meses % 12 };
};

// Solo se pide guardar como recuerdo las citas de las últimas semanas
const DIAS_PARA_RECUERDO = 30;

// Cartas ya está en la barra de abajo
const ACCESOS = [
  { to: '/juntos', Icono: IconoLista, label: 'Por hacer' },
  { to: '/juntos?tab=regalos', Icono: IconoRegalo, label: 'Regalos' },
  { to: '/juntos?tab=canciones', Icono: IconoMusica, label: 'Canciones' },
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
  const pendientes = usePendientes();
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

  const tiempoTexto = tiempo && [
    tiempo.anios > 0 && `${tiempo.anios} ${tiempo.anios === 1 ? 'año' : 'años'}`,
    tiempo.meses > 0 && `${tiempo.meses} ${tiempo.meses === 1 ? 'mes' : 'meses'}`,
  ].filter(Boolean).join(' y ');

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <header className="pt-2 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-[2.4rem] leading-[1.05] font-bold">Hiii, <span className="italic font-medium text-bosque">{config?.apodo_ella ?? 'Ma vie'}</span> <Corazon className="inline-block w-7 h-7 -mt-1.5 text-bosque" /></h1>
          <p className="text-salvia mt-1 first-letter:uppercase">{hoyBonito()}</p>
        </div>
        <button onClick={() => setAjustes(true)} className="btn-icon relative shrink-0 mt-1" aria-label={pendientes > 0 ? `Ajustes: ${pendientes} ${pendientes === 1 ? 'cita' : 'citas'} por confirmar` : 'Ajustes'}>
          <IconoDeslizadores className="w-5 h-5" />
          {pendientes > 0 && <span className="absolute -top-1 -right-1 bg-alerta text-white text-xs font-extrabold rounded-full min-w-5 h-5 px-1 flex items-center justify-center ring-2 ring-crema">{pendientes}</span>}
        </button>
      </header>

      {/* El mar: la ballena manda y los días juntos acompañan */}
      <Mar className="h-[172px] p-0" aria-label={`Llevamos ${diasJuntos} días juntos`}>
        <div className="absolute right-[-6px] bottom-3 w-[206px]">
          <Ballena className="w-full" />
        </div>
        <Olas className="absolute bottom-0 inset-x-0 h-5" color="#CFE9E4" opacidad={0.14} />
        <p className="absolute left-5 top-4 text-white">
          <span className="block font-titulo text-[2.9rem] font-bold leading-none tabular-nums"><Contador valor={diasJuntos} /></span>
          <span className="block font-bold mt-0.5">días juntos</span>
          {tiempoTexto && <span className="block text-sm">{tiempoTexto}</span>}
        </p>
      </Mar>

      {/* Lo de hoy primero: la pregunta */}
      {pregunta && (ambosRespondieron ? (
        <Link to="/preguntas" className="card p-4 flex items-center gap-3">
          <span className="w-11 h-11 shrink-0 rounded-full bg-seleccion text-bosque flex items-center justify-center"><IconoCheck className="w-5 h-5" /></span>
          <div className="flex-1 min-w-0">
            <p className="font-titulo text-lg font-semibold leading-tight">Los dos respondieron la pregunta de hoy</p>
            {racha > 0 && <p className="text-sm font-bold text-coral flex items-center gap-1 mt-0.5"><IconoFuego className="w-4 h-4" /> {racha} {racha === 1 ? 'día seguido' : 'días seguidos'}</p>}
          </div>
          <IconoFlecha className="w-4 h-4 text-bosque shrink-0" />
        </Link>
      ) : (
        <Link to="/preguntas" className="card block">
          <h2 className="text-[1.65rem] font-semibold leading-[1.15]">{pregunta.texto}</h2>
          <p className="text-sm text-salvia mt-2">
            {estado.yo ? `La pregunta de hoy. Ya respondiste; ${pareja} aún no.` : estado.pareja ? `La pregunta de hoy. ${pareja} ya respondió, falta la tuya.` : 'La pregunta de hoy. Falta la tuya.'}
          </p>
          <div className="flex items-center justify-between gap-3 mt-4">
            {racha > 0 ? <span className="text-sm font-bold text-coral flex items-center gap-1"><IconoFuego className="w-4 h-4" /> {racha} {racha === 1 ? 'día seguido' : 'días seguidos'}</span> : <span />}
            <span className={estado.yo ? 'btn-soft' : 'btn-primary'}>{estado.yo ? 'Ver' : 'Responder'} <IconoFlecha /></span>
          </div>
        </Link>
      ))}

      {/* Una carta esperando es un sobre, no un aviso más */}
      {cartas.porAbrir > 0 && (
        <Link to="/cartas" className="sobre" data-estado="nueva">
          <SolapaSobre />
          <p className="font-titulo italic font-medium text-2xl leading-tight mt-4">Tienes {cartas.porAbrir} {cartas.porAbrir === 1 ? 'carta' : 'cartas'} por abrir</p>
          <p className="text-sm text-salvia mt-1">{pareja} te {cartas.porAbrir === 1 ? 'la' : 'las'} dejó. Toca para ir a {cartas.porAbrir === 1 ? 'abrirla' : 'abrirlas'}.</p>
        </Link>
      )}

      {/* Pendientes: solo aparecen cuando hay algo por hacer (si no hay nada, el bloque no ocupa espacio) */}
      <div className="flex flex-col gap-2 empty:hidden">
        {/* flores (temporal) */}
        <AvisoFlores />
        {sinRecuerdo && (
          <Link to="/historia" className="fila-aviso min-h-14 bg-durazno/20 border-durazno/50">
            <IconoCamara className="w-5 h-5 text-coral shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight">¿Cómo nos fue? Guardémosla como recuerdo</p>
              {nombreLugar(sinRecuerdo) && <p className="text-sm text-salvia truncate">{nombreLugar(sinRecuerdo)}</p>}
            </div>
            <IconoFlecha className="w-4 h-4 text-coral" />
          </Link>
        )}
        {anioResumen && (
          <Link to={`/resumen?anio=${anioResumen}`} className="fila-aviso min-h-14">
            <IconoDestello className="w-5 h-5 text-bosque shrink-0" />
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

      <LoQueViene cita={proxima} config={config} esAdmin={esAdmin} />

      <UnDiaComoHoy />

      <nav className="grid grid-cols-3 gap-2" aria-label="Accesos">
        {ACCESOS.map(({ to, Icono, label }) => (
          <Link key={to} to={to} className="acceso">
            <span className="acceso-icono text-bosque"><Icono className="w-6 h-6" /></span>
            {label}
          </Link>
        ))}
      </nav>

      <Ajustes abierto={ajustes} onClose={() => setAjustes(false)} />
    </div>
  );
}
