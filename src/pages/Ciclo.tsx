import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useCiclo, useRecibido } from '../lib/ciclo/useCiclo';
import { faseEn } from '../lib/ciclo/prediccion';
import { Encabezado, Esqueleto, IconoAdelante, IconoAtras, IconoCandado, Segmented } from '../components/ui';
import Empezar from '../components/ciclo/Empezar';
import Desbloquear, { LlavesPerdidas } from '../components/ciclo/Desbloquear';
import Hoy from '../components/ciclo/Hoy';
import Calendario from '../components/ciclo/Calendario';
import Compartir from '../components/ciclo/Compartir';
import ParaTi from '../components/ciclo/ParaTi';
import Planificacion from '../components/ciclo/Planificacion';
import Relojes from '../components/ciclo/Relojes';
import Informe from '../components/ciclo/Informe';
import Aprender from '../components/ciclo/Aprender';
import MisDatos from '../components/ciclo/MisDatos';
import AjustesCiclo from '../components/ciclo/AjustesCiclo';

type Tab = 'hoy' | 'calendario' | 'compartir' | 'pareja' | 'aprender' | 'mas';
type Sub = 'planificacion' | 'relojes' | 'informe' | 'aprender' | 'datos' | 'ajustes';

const SUBS: Record<Sub, string> = {
  ajustes: 'Mi ciclo',
  planificacion: 'Planificación familiar',
  relojes: 'Relojes y anillos',
  informe: 'Informe para el médico',
  aprender: 'Aprender',
  datos: 'Mis datos y privacidad',
};

// Ciclo menstrual: cifrado de extremo a extremo. Se abre desde Ajustes o desde el aviso de la pareja
export default function CicloPagina() {
  const { perfil } = useAuth();
  const [nombres, setNombres] = useState<{ yo: string; pareja: string; admin: string } | null>(null);

  useEffect(() => {
    supabase.from('configuracion').select('nombre_ella, nombre_el').eq('id', 1).single().then(({ data }) => {
      const el = data?.nombre_el ?? 'Oscar';
      const ella = data?.nombre_ella ?? 'Sarah';
      setNombres(perfil?.rol === 'admin' ? { yo: el, pareja: ella, admin: el } : { yo: ella, pareja: el, admin: el });
    });
  }, [perfil?.rol]);

  if (!perfil || !nombres) return <div className="p-5 max-w-lg mx-auto"><Esqueleto className="h-40" /></div>;
  // Él no lleva ciclo: solo recibe lo que ella decida compartirle. rol dice quién es (no el permiso esAdmin, que ella también tiene)
  return <Contenido uid={perfil.id} {...nombres} soloRecibe={perfil.rol === 'admin'} />;
}

function Contenido({ uid, yo, pareja, admin, soloRecibe }: { uid: string; yo: string; pareja: string; admin: string; soloRecibe: boolean }) {
  const ciclo = useCiclo(uid);
  const recibido = useRecibido(uid, ciclo.estado === 'lista' ? ciclo.llaves : null);
  const [configurando, setConfigurando] = useState<null | 'todo' | 'registro'>(null);
  const [params, setParams] = useSearchParams();
  // Aunque él haya llegado a guardar un registro antes, no se le muestra: su vista es solo la de recibir
  const registra = !soloRecibe && !!ciclo.ajustes;
  const recibe = !!recibido.vista || recibido.avisos.length > 0;

  const tabs: [Tab, string][] = registra
    ? [['hoy', 'Hoy'], ['calendario', 'Calendario'], ['compartir', 'Compartir'], ...(recibe ? [['pareja', pareja] as [Tab, string]] : []), ['mas', 'Más']]
    : [['pareja', 'Para ti'], ['aprender', 'Aprender'], ['mas', 'Más']];
  const pedido = params.get('tab') as Tab | null;
  const tab: Tab = tabs.some(([k]) => k === pedido) ? pedido! : tabs[0][0];
  const sub = params.get('ver') as Sub | null;
  const ir = (t: Tab, s?: Sub) => setParams(s ? { tab: t, ver: s } : t === tabs[0][0] ? {} : { tab: t }, { replace: !s });
  // La fase de hoy (la suya o la que ella compartió) solo sirve para sugerirle preguntas a Payakan;
  // no se le manda a menos que la persona toque esa pregunta
  const fasesHoy = registra ? ciclo.prediccion?.tramos : recibido.vista?.vista.fases;
  const fase = ciclo.estado === 'lista' && fasesHoy ? faseEn(fasesHoy, ciclo.hoy)?.fase : undefined;
  const aprender = <Aprender paraPareja={!registra} pareja={pareja} fase={fase} />;

  let cuerpo: React.ReactNode;
  if (ciclo.estado === 'cargando') cuerpo = <Esqueleto className="h-56" />;
  else if (ciclo.estado === 'error') cuerpo = (
    <section className="card flex flex-col gap-3">
      <p className="font-bold">No pude abrir esta sección.</p>
      <p className="text-sm text-salvia">Revisa tu conexión.</p>
      <button className="btn-soft" onClick={ciclo.iniciar}>Intentar de nuevo</button>
    </section>
  );
  else if (ciclo.estado === 'nueva' || configurando) cuerpo = (
    <Empezar ciclo={ciclo} pareja={pareja} nombreAdmin={admin} soloRecibe={soloRecibe} soloRegistro={configurando === 'registro'}
      onEmpezar={() => setConfigurando((c) => c ?? 'todo')} onTerminar={() => setConfigurando(null)} />
  );
  else if (ciclo.estado === 'bloqueada') cuerpo = <Desbloquear ciclo={ciclo} />;
  else if (ciclo.estado === 'perdida') cuerpo = <LlavesPerdidas ciclo={ciclo} />;
  else if (sub && SUBS[sub]) cuerpo = (
    <div className="flex flex-col gap-4">
      <button className="btn-soft self-start" onClick={() => window.history.length > 1 ? window.history.back() : ir('mas')}><IconoAtras className="w-4 h-4" />Más</button>
      {sub === 'ajustes' && registra && <AjustesCiclo ciclo={ciclo} />}
      {sub === 'planificacion' && registra && <Planificacion ciclo={ciclo} pareja={pareja} />}
      {sub === 'relojes' && registra && <Relojes ciclo={ciclo} />}
      {sub === 'informe' && registra && <Informe ciclo={ciclo} yo={yo} />}
      {sub === 'aprender' && aprender}
      {sub === 'datos' && <MisDatos ciclo={ciclo} uid={uid} nombreAdmin={admin} />}
    </div>
  );
  else cuerpo = (
    <div className="flex flex-col gap-4">
      {/* Apretadas como en Juntos para que quepan en 360 px */}
      <Segmented id="tabs-ciclo" className="[&_.segmented-item]:px-1 [&_.segmented-item]:text-[0.8rem]" value={tab} onChange={(t) => ir(t)} options={tabs} />
      {ciclo.ilegibles > 0 && <p className="text-sm text-coral px-1" role="alert">{ciclo.ilegibles} registros no se pudieron abrir con tu llave.</p>}
      {tab === 'hoy' && registra && <Hoy ciclo={ciclo} pareja={pareja} irA={(t) => ir(t)} />}
      {tab === 'calendario' && registra && <Calendario ciclo={ciclo} />}
      {tab === 'compartir' && registra && <Compartir ciclo={ciclo} pareja={pareja} yo={yo} />}
      {tab === 'pareja' && <ParaTi vista={recibido.vista} avisos={recibido.avisos} hoy={ciclo.hoy} pareja={pareja} cargado={recibido.cargado} onDescartar={recibido.descartar}
        onPreguntar={() => (registra ? ir('mas', 'aprender') : ir('aprender'))} />}
      {tab === 'aprender' && aprender}
      {tab === 'mas' && (
        <nav className="flex flex-col gap-2" aria-label="Más opciones del ciclo">
          {(registra ? (['ajustes', 'planificacion', 'relojes', 'informe', 'aprender', 'datos'] as Sub[]) : (['datos'] as Sub[])).map((s) => (
            <button key={s} className="fila-aviso min-h-14 text-left" onClick={() => ir('mas', s)}>
              <span className="flex-1 font-bold">{SUBS[s]}</span>
              <IconoAdelante className="w-4 h-4 text-bosque" />
            </button>
          ))}
          {!registra && !soloRecibe && (
            <button className="fila-aviso min-h-14 text-left" onClick={() => setConfigurando('registro')}>
              <span className="flex-1 font-bold">Llevar mi ciclo también</span>
              <IconoAdelante className="w-4 h-4 text-bosque" />
            </button>
          )}
        </nav>
      )}
    </div>
  );

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Link to="/" className="btn-icon" aria-label="Volver al inicio"><IconoAtras /></Link>
      <Encabezado eyebrow={registra ? 'Solo tú decides qué se ve' : `Lo que ${pareja} te comparta`} titulo="Ciclo">
        <span className="badge bg-seleccion text-bosque border border-menta mb-1" title="Cifrado de extremo a extremo"><IconoCandado className="w-3.5 h-3.5" />Cifrado</span>
      </Encabezado>
      {cuerpo}
    </div>
  );
}
