import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { hoyStr } from '../lib/utils';
import CitaWizard, { type LugarInicial, type PlanCita } from '../components/CitaWizard';
import EditarCita from '../components/EditarCita';
import TarjetaCita from '../components/TarjetaCita';
import { AnimatePresence } from 'framer-motion';
import { MascotaPrimaria, Acompanantes, Mar } from '../components/MascotaDinamica';
import { Encabezado, Esqueleto, Segmented, Vacio, IconoMas, ColaBallena, IconoFlecha } from '../components/ui';
import { useAvisos } from '../lib/avisos';

const VIVIDAS_POR_PAGINA = 15;

export default function Citas() {
  const { perfil } = useAuth();
  const { revisar, confirmar, aviso } = useAvisos();
  const [tab, setTabEstado] = useState<'proximas' | 'confirmar' | 'vividas'>('proximas');
  const [limite, setLimite] = useState(VIVIDAS_POR_PAGINA);
  const setTab = (t: typeof tab) => { setTabEstado(t); setLimite(VIVIDAS_POR_PAGINA); };
  const [citas, setCitas] = useState<any[]>([]);
  const [cargado, setCargado] = useState(false);
  // Viene de Juntos ("Planear" un plan) o del mapa ("Planear una cita aquí"): el asistente se abre con eso puesto
  const estado = useLocation().state as { plan?: PlanCita; lugar?: LugarInicial } | null;
  const navigate = useNavigate();
  const [desde, setDesde] = useState<{ plan?: PlanCita; lugar?: LugarInicial } | null>(estado?.plan || estado?.lugar ? estado : null);
  // El atajo "Planear una cita" del ícono llega con ?nueva=1
  const [wizard, setWizard] = useState<false | 'nueva' | 'pasada'>(desde || new URLSearchParams(window.location.search).has('nueva') ? 'nueva' : false);
  useEffect(() => { if (window.location.search.includes('nueva')) navigate('/citas', { replace: true }); }, [navigate]);
  // Que no se vuelva a abrir solo al recargar o al volver atrás
  useEffect(() => { if (estado?.plan || estado?.lugar) navigate('/citas', { replace: true, state: null }); }, [estado, navigate]);
  const [editando, setEditando] = useState<any>(null);
  const [verCanceladas, setVerCanceladas] = useState(false);

  const cargar = async () => {
    const { data } = await supabase
      .from('citas')
      .select('*, lugares(nombre,emoji,lat,lng), actividades(nombre), franjas(nombre), categorias_cita(nombre,emoji), recuerdos(id)')
      .order('fecha');
    setCitas(data ?? []);
    setCargado(true);
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
  // Invitación que hizo el otro: la acepta o dice que no puede
  const responder = async (id: string, acepta: boolean) => {
    if (!acepta && !(await confirmar({ titulo: '¿No puedes ir a esta cita?', texto: 'Se cancela y le llega el aviso.', boton: 'No puedo', peligro: true }))) return;
    const { error } = revisar(await supabase.from('citas').update({ estado: acepta ? 'confirmada' : 'cancelada' }).eq('id', id), 'No pude responder la invitación');
    if (!error && acepta) aviso('¡Cita aceptada! 💚');
    cargar();
  };

  // Ya la vivieron pero no la han guardado como recuerdo: se marca a mano
  const marcarVivida = async (id: string) => {
    const { error } = revisar(await supabase.from('citas').update({ estado: 'vivida' }).eq('id', id), 'No pude marcarla como vivida');
    if (!error) aviso('Quedó en Vividas 💚');
    cargar();
  };

  // Confirmadas cuyo día ya pasó: nadie las cerró (ni recuerdo ni "ya la vivimos")
  const yaPaso = (c: any) => c.estado === 'confirmada' && c.fecha < hoyStr();
  const canceladas = citas.filter((c) => c.estado === 'cancelada');
  const filtradas = citas.filter((c) => {
    if (tab === 'proximas') return c.estado === 'confirmada' && c.fecha >= hoyStr();
    if (tab === 'confirmar') return c.estado === 'pendiente';
    return c.estado === 'vivida' || yaPaso(c) || (verCanceladas && c.estado === 'cancelada');
  });
  // Las vividas, de la más reciente a la más vieja y por partes; primero las que faltan por cerrar
  const lista = tab === 'vividas' ? [...filtradas].reverse().sort((a, b) => Number(yaPaso(b)) - Number(yaPaso(a))).slice(0, limite) : filtradas;
  const faltan = filtradas.length - lista.length;

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Encabezado eyebrow="Tú y yo, en el calendario" titulo="Citas" />

      <button onClick={() => setWizard('nueva')} className="text-left active:scale-[0.98] transition-transform">
        <Mar className="min-h-[136px]">
          <p className="relative font-titulo text-[1.7rem] font-bold leading-tight max-w-[58%]">Planear una cita</p>
          <p className="relative text-sm text-white mt-1 max-w-[56%]">Escoge el plan, el lugar y el día; yo me encargo del resto.</p>
          <MascotaPrimaria className="absolute right-2 bottom-3 w-[150px]" />
          <Acompanantes className="absolute right-12 top-0 w-24" />
        </Mar>
      </button>

      <button onClick={() => setWizard('pasada')} className="btn-soft -mt-1"><IconoMas className="w-4 h-4" /> Agregar una cita que ya pasó</button>
      <Link to="/asistente" className="fila-aviso min-h-14">
        <ColaBallena className="w-5 h-5 text-bosque shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-sm leading-tight">¿Sin ideas? Pregúntale a Ballena</span>
          <span className="block text-sm text-salvia">Arma una cita con su presupuesto, el clima y lo que les gusta</span>
        </span>
        <IconoFlecha className="w-4 h-4 text-bosque shrink-0" />
      </Link>

      <Segmented id="tabs-citas" value={tab} onChange={setTab} options={[['proximas', 'Próximas'], ['confirmar', 'Por confirmar'], ['vividas', 'Vividas']] as const} />

      <div className="flex flex-col gap-3 stagger" key={tab}>
        {!cargado && <Esqueleto className="h-44" />}
        {cargado && filtradas.length === 0 && <Vacio titulo="Aún no hay nada aquí" texto="Las ballenas esperan su próxima aventura juntas." />}
        {lista.map((c) => (
          <TarjetaCita key={c.id} c={c} perfil={perfil} pasada={yaPaso(c)} onEditar={() => setEditando(c)}
            onCancelar={() => cancelar(c.id)} onResponder={(acepta) => responder(c.id, acepta)} onVivida={() => marcarVivida(c.id)} />
        ))}
        {faltan > 0 && (
          <button onClick={() => setLimite(limite + VIVIDAS_POR_PAGINA)} className="btn-soft">Ver más citas vividas ({faltan})</button>
        )}
        {tab === 'vividas' && canceladas.length > 0 && (
          <button onClick={() => setVerCanceladas(!verCanceladas)} aria-expanded={verCanceladas} className="self-center min-h-11 px-3 text-sm font-bold text-salvia">
            {verCanceladas ? 'Ocultar las canceladas' : `Ver las canceladas (${canceladas.length})`}
          </button>
        )}
      </div>

      {wizard && <CitaWizard pasada={wizard === 'pasada'} plan={desde?.plan} lugarInicial={desde?.lugar} onClose={() => { setWizard(false); setDesde(null); cargar(); }} />}
      <AnimatePresence>
        {editando && <EditarCita cita={editando} onClose={() => setEditando(null)} onSaved={cargar} />}
      </AnimatePresence>
    </div>
  );
}
