import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fechaBonita, diasEntre, hoyStr, hoyBonito, nombreLugar } from '../lib/utils';
import { Link } from 'react-router-dom';
import Ballena, { Olas, Burbujas } from '../components/Ballena';
import { Contador, Corazon, IconoFlecha } from '../components/ui';
import AvisoNotificaciones from '../components/AvisoNotificaciones';
import PiensoEnTi from '../components/PiensoEnTi';
import ProximaFecha from '../components/ProximaFecha';
import EstadoAnimo from '../components/EstadoAnimo';
import UnDiaComoHoy from '../components/UnDiaComoHoy';

const desglose = (inicio: string) => {
  const a = new Date(inicio + 'T00:00:00');
  const b = new Date();
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) meses--;
  return { anios: Math.floor(meses / 12), meses: meses % 12 };
};

export default function Inicio() {
  const { perfil, salir } = useAuth();
  const [config, setConfig] = useState<any>(null);
  const [proxima, setProxima] = useState<any>(null);
  const [pregunta, setPregunta] = useState<any>(null);
  const [estado, setEstado] = useState<{ yo: boolean; pareja: boolean }>({ yo: false, pareja: false });
  const [recuerdo, setRecuerdo] = useState<any>(null);
  const [pendientesRecuerdo, setPendientesRecuerdo] = useState<any>(null);
  const [cartas, setCartas] = useState<{ porAbrir: number; total: number }>({ porAbrir: 0, total: 0 });
  const [racha, setRacha] = useState(0);

  useEffect(() => {
    supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setConfig(data));
    supabase.from('citas').select('*, lugares(nombre,emoji), actividades(nombre), franjas(nombre)').eq('estado', 'confirmada').gte('fecha', hoyStr()).order('fecha').limit(1).maybeSingle().then(({ data }) => setProxima(data));
    // cita pasada confirmada sin recuerdo
    supabase.from('citas').select('*, lugares(nombre)').eq('estado', 'confirmada').lt('fecha', hoyStr()).order('fecha', { ascending: false }).limit(1).maybeSingle().then(({ data }) => setPendientesRecuerdo(data));
    supabase.rpc('obtener_pregunta_del_dia').then(({ data }) => {
      setPregunta(data);
      if (data?.id) supabase.rpc('estado_respuestas', { p_pregunta_id: data.id }).then(({ data: e }) => { if (e?.[0]) setEstado(e[0]); });
    });
    supabase.from('recuerdos').select('*').order('fecha', { ascending: false }).limit(1).maybeSingle().then(({ data }) => setRecuerdo(data));
    supabase.rpc('racha_preguntas').then(({ data }) => setRacha(data?.[0]?.dias ?? 0));
    supabase.rpc('cartas_recibidas').then(({ data }) => setCartas({ porAbrir: (data ?? []).filter((c: any) => c.disponible && !c.abierta_en).length, total: (data ?? []).length }));
  }, []);

  const diasJuntos = config ? -diasEntre(config.fecha_inicio) : 0;
  const tiempo = config?.fecha_inicio ? desglose(config.fecha_inicio) : null;
  const yaRespondiYo = estado.yo;
  const yaRespondioElla = estado.pareja;
  const pareja = (perfil?.rol === 'admin' ? config?.nombre_ella : config?.nombre_el) ?? (perfil?.rol === 'admin' ? 'Ella' : 'Él');
  const faltan = proxima ? diasEntre(proxima.fecha) : null;
  const hoyTxt = hoyBonito();

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4 stagger">
      <header className="pt-2">
        <p className="eyebrow first-letter:uppercase">{hoyTxt}</p>
        <h1 className="text-[2.1rem] leading-tight font-bold">Hiii, <span className="italic text-bosque">{config?.apodo_ella ?? 'Ma vie'}</span> 💚</h1>
      </header>

      {/* Héroe: los días juntos, bajo el mar */}
      <section className="card-hero min-h-[230px]">
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

      {perfil && <PiensoEnTi yo={perfil.id} pareja={pareja} />}
      {perfil && <EstadoAnimo yo={perfil.id} pareja={pareja} />}

      {config && <ProximaFecha config={config} esAdmin={perfil?.rol === 'admin'} />}

      <AvisoNotificaciones />
      <UnDiaComoHoy />


      {pendientesRecuerdo && (
        <Link to="/historia" className="card p-4 flex items-center gap-3 bg-durazno/25 border-durazno/50">
          <span className="text-3xl">📸</span>
          <div className="flex-1">
            <p className="font-bold leading-tight">¿Cómo nos fue? Guardémosla como recuerdo</p>
            <p className="text-sm text-salvia">{nombreLugar(pendientesRecuerdo)}</p>
          </div>
          <IconoFlecha className="w-5 h-5 text-coral" />
        </Link>
      )}

      {proxima ? (
        <div className="card flex gap-4 items-center">
          <div className="shrink-0 w-[72px] h-[78px] rounded-2xl bg-gradient-to-b from-esmeralda to-bosque text-white flex flex-col items-center justify-center shadow-soft">
            <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">{faltan === 0 ? 'hoy' : 'faltan'}</span>
            <span className="font-titulo text-3xl font-bold leading-none">{faltan === 0 ? '🎉' : faltan}</span>
            {faltan !== 0 && <span className="text-[10px] font-bold opacity-80">{faltan === 1 ? 'día' : 'días'}</span>}
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Próxima cita</p>
            <p className="font-titulo text-xl font-semibold leading-tight truncate">{proxima.lugares?.emoji ?? (proxima.lugar_personalizado ? '📍' : '')} {nombreLugar(proxima) ?? 'Sorpresa'}</p>
            {proxima.actividades?.nombre && <p className="text-sm font-semibold text-bosque">{proxima.actividades.nombre}</p>}
            <p className="text-xs text-salvia capitalize mt-0.5">{fechaBonita(proxima.fecha)} · {proxima.franjas?.nombre} {proxima.hora_confirmada ? `· ${proxima.hora_confirmada}` : ''}</p>
          </div>
        </div>
      ) : (
        <Link to="/citas" className="card flex items-center gap-4 group">
          <span className="w-14 h-14 rounded-2xl bg-seleccion border border-menta flex items-center justify-center text-2xl">💌</span>
          <div className="flex-1">
            <p className="font-titulo text-lg font-semibold">Aún no tenemos próxima cita</p>
            <p className="text-salvia text-sm">Toca para planear una</p>
          </div>
          <IconoFlecha className="w-5 h-5 text-bosque transition-transform group-active:translate-x-1" />
        </Link>
      )}

      {pregunta && (
        <div className="card relative overflow-hidden">
          <span className="absolute right-3 -top-3 text-[96px] font-titulo text-menta/70 leading-none select-none" aria-hidden="true">?</span>
          <p className="eyebrow relative">Pregunta del día 💭{racha > 0 && <span className="ml-2 normal-case tracking-normal text-coral">🔥 {racha} {racha === 1 ? 'día' : 'días'}</span>}</p>
          <p className="font-titulo text-xl font-semibold leading-snug mt-1 relative">{pregunta.texto}</p>
          <div className="flex flex-wrap gap-2 mt-3 relative">
            <span className={`badge ${yaRespondiYo ? 'bg-seleccion text-bosque' : 'bg-durazno/30 text-coral'}`}>{yaRespondiYo ? '✓ Ya respondiste' : '✏️ Falta la tuya'}</span>
            <span className={`badge ${yaRespondioElla ? 'bg-seleccion text-bosque' : 'bg-crema text-salvia border border-menta'}`}>{yaRespondioElla ? `✓ ${pareja} ya respondió` : `⏳ ${pareja} aún no`}</span>
          </div>
          <Link to="/preguntas" className="btn-soft w-full mt-4 relative">Ir a responder <IconoFlecha /></Link>
        </div>
      )}
      <Link to="/cartas" className={`card flex items-center gap-4 ${cartas.porAbrir ? 'border-2 border-esmeralda bg-seleccion' : ''}`}>
        <span className="w-14 h-14 rounded-2xl bg-crema border border-menta flex items-center justify-center text-2xl">💌</span>
        <div className="flex-1 min-w-0">
          <p className="eyebrow">Cartas para después</p>
          <p className="font-titulo text-lg font-semibold leading-tight">
            {cartas.porAbrir ? `Tienes ${cartas.porAbrir} ${cartas.porAbrir === 1 ? 'carta' : 'cartas'} por abrir ✨` : `Escríbele una carta a ${pareja}`}
          </p>
        </div>
        <IconoFlecha className="w-5 h-5 text-bosque" />
      </Link>


      <div className="grid grid-cols-2 gap-3">
        <Link to="/juntos" className="card p-4 flex flex-col gap-1">
          <span className="text-2xl">✨</span>
          <p className="font-bold leading-tight">Por hacer juntos</p>
          <p className="text-xs text-salvia">Lo que queremos vivir</p>
        </Link>
        <Link to="/juntos?tab=regalos" className="card p-4 flex flex-col gap-1">
          <span className="text-2xl">🎁</span>
          <p className="font-bold leading-tight">Lista de regalos</p>
          <p className="text-xs text-salvia">Ideas sin spoilers 🤫</p>
        </Link>
        <Link to="/juntos?tab=canciones" className="card p-4 flex items-center gap-3 col-span-2">
          <span className="text-2xl">🎵</span>
          <div className="flex-1">
            <p className="font-bold leading-tight">Nuestras canciones</p>
            <p className="text-xs text-salvia">La banda sonora de los dos</p>
          </div>
          <IconoFlecha className="w-5 h-5 text-bosque" />
        </Link>
      </div>

      {recuerdo && (
        <Link to="/historia" className="card flex items-center gap-4">
          <span className="w-14 h-14 rounded-2xl bg-espuma flex items-center justify-center text-2xl">📸</span>
          <div className="flex-1 min-w-0">
            <p className="eyebrow">Recuerdo reciente</p>
            <p className="font-titulo text-lg font-semibold truncate">{recuerdo.titulo}</p>
            <div className="flex items-center gap-2 text-xs text-salvia">
              <span className="capitalize">{fechaBonita(recuerdo.fecha)}</span>
              <span className="flex text-esmeralda">{Array.from({ length: recuerdo.calificacion }).map((_, i) => <Corazon key={i} className="w-3 h-3" />)}</span>
            </div>
          </div>
        </Link>
      )}

      <button onClick={async () => { if (confirm('¿Cerrar sesión en este celular? Dejarán de llegarte los avisos aquí.')) await salir(); }}
        className="text-sm font-bold text-salvia mx-auto mt-2 py-2 px-4">
        Cerrar sesión
      </button>
    </div>
  );
}
