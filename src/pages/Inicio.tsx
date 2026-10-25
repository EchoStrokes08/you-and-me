// La pantalla de entrada de la app: saludo con los días juntos, pregunta del día (con la racha),
// cartas y cupones pendientes, cómo estamos hoy, lo que viene y los atajos. Los datos los trae
// useDatosInicio; aquí además sube ese número al ícono de la app y avisa de copias y fechas.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { diasEntre, diasSinCopia, DIAS_ENTRE_COPIAS, hoyStr, hoyBonito, nombreLugar } from '../lib/utils';
import { usePendientes } from '../lib/pendientes';
import type { Cita, Configuracion, Pregunta } from '../lib/tipos';
import { useDatosInicio, type DatosInicio } from './inicio/datos';
import { MascotaPrimaria, Acompanantes, Mar, Olas } from '../components/MascotaDinamica';
import { ColaBallena, Contador, Corazon, IconoCamara, IconoCheck, IconoDescarga, IconoDeslizadores, IconoDestello, IconoFlecha, IconoFuego, IconoLista, IconoPeli, IconoPlay, IconoRegalo, IconoVale, SolapaSobre } from '../components/ui';
import AvisoNotificaciones from '../components/AvisoNotificaciones';
import PiensoEnTi from '../components/PiensoEnTi';
import EstadoAnimo from '../components/EstadoAnimo';
import LoQueViene from '../components/LoQueViene';
import UnDiaComoHoy from '../components/UnDiaComoHoy';
import Ajustes from '../components/Ajustes';
import LoQueMeGusto from '../components/LoQueMeGusto';
import RetoDelMes from '../components/RetoDelMes';
import { AvisoDiaImportante } from '../components/DiasImportantes';
import { proximaFechaEspecial } from '../components/ProximaFecha';
import AvisoFlores from '../especiales/flores/AvisoFlores'; // flores (temporal)

/* El inicio, de arriba hacia abajo: el saludo, los días juntos, la pregunta de hoy,
   las cartas por abrir, lo pendiente, cómo estamos hoy, lo que viene y los atajos a Juntos. */

export default function Inicio() {
  const { perfil } = useAuth();
  const datos = useDatosInicio(perfil?.id);
  const { config, pregunta, respondieron, cartas, valesPorCumplir } = datos;
  const citasPorConfirmar = usePendientes();
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);

  // El atajo "Pienso en ti" del ícono de la app llega con ?pienso=1
  const [params, setParams] = useSearchParams();

  const soyEl = perfil?.rol === 'admin';
  const pareja = (soyEl ? config?.nombre_ella : config?.nombre_el) ?? (soyEl ? 'Ella' : 'Él');

  // El número en el ícono de la app: lo que está esperando a que uno haga algo
  useNumeroEnElIcono(
    (pregunta && !respondieron.yo ? 1 : 0) + cartas.porAbrir + valesPorCumplir + (perfil?.esAdmin ? citasPorConfirmar : 0),
  );

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Saludo apodo={config?.apodo_ella} citasPorConfirmar={citasPorConfirmar} onAjustes={() => setAjustesAbiertos(true)} />

      <DiasJuntos config={config} />

      {pregunta && <PreguntaDeHoy pregunta={pregunta} respondieron={respondieron} racha={datos.racha} pareja={pareja} />}

      {cartas.porAbrir > 0 && <CartasPorAbrir cuantas={cartas.porAbrir} pareja={pareja} />}

      <Pendientes datos={datos} pareja={pareja} soyEl={soyEl} />

      {perfil && (
        <section className="card flex flex-col gap-4 overflow-hidden" aria-label="Nosotros hoy">
          <PiensoEnTi yo={perfil.id} pareja={pareja} alAbrir={params.has('pienso') && !!config} onEnviadoAlAbrir={() => setParams({}, { replace: true })} />
          <div className="border-t border-menta -mx-5" />
          <EstadoAnimo key={hoyStr()} yo={perfil.id} pareja={pareja} cartasMomento={cartas.momento} />
        </section>
      )}

      {perfil && <LoQueMeGusto key={`gusto-${hoyStr()}`} yo={perfil.id} pareja={pareja} />}

      <LoQueViene cita={datos.proximaCita} config={config} soyEl={soyEl} />

      <UnDiaComoHoy key={hoyStr()} />

      <AtajosAJuntos />

      <Ajustes abierto={ajustesAbiertos} onClose={() => setAjustesAbiertos(false)} />
    </div>
  );
}

function Saludo({ apodo, citasPorConfirmar, onAjustes }: { apodo?: string; citasPorConfirmar: number; onAjustes: () => void }) {
  return (
    <header className="pt-2 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <h1 className="text-[2.4rem] leading-[1.05] font-bold">Hiii, <span className="italic font-medium text-bosque">{apodo ?? 'Ma vie'}</span> <Corazon className="inline-block w-7 h-7 -mt-1.5 text-bosque" /></h1>
        <p className="text-salvia mt-1 first-letter:uppercase">{hoyBonito()}</p>
      </div>
      <Link to="/asistente" className="btn-icon shrink-0 mt-1 bg-hondo text-lima border-hondo" aria-label="Hablar con Payakan, el asistente"><ColaBallena className="w-5 h-5" /></Link>
      <button onClick={onAjustes} className="btn-icon relative shrink-0 mt-1" aria-label={citasPorConfirmar > 0 ? `Ajustes: ${citasPorConfirmar} ${citasPorConfirmar === 1 ? 'cita' : 'citas'} por confirmar` : 'Ajustes'}>
        <IconoDeslizadores className="w-5 h-5" />
        {citasPorConfirmar > 0 && <span className="absolute -top-1 -right-1 bg-alerta text-white text-xs font-extrabold rounded-full min-w-5 h-5 px-1 flex items-center justify-center ring-2 ring-crema">{citasPorConfirmar}</span>}
      </button>
    </header>
  );
}

/** El mar: la ballena manda y los días juntos acompañan */
function DiasJuntos({ config }: { config: Configuracion | null }) {
  const dias = config ? -diasEntre(config.fecha_inicio) : 0;
  const tiempo = config ? tiempoJuntos(config.fecha_inicio) : '';
  return (
    <Mar className="h-[188px] p-0" aria-label={`Llevamos ${dias} días juntos`}>
      <div className="absolute right-2 bottom-4 w-[200px]">
        <MascotaPrimaria className="w-full" />
      </div>
      {/* Abajo y chiquitos: el texto de los días queda con su espacio libre */}
      <Acompanantes className="absolute left-3 bottom-1 w-[100px]" />
      <Olas className="absolute bottom-0 inset-x-0 h-5" color="#CFE9E4" opacidad={0.14} />
      <p className="absolute left-5 top-4 text-white">
        <span className="block font-titulo text-[2.9rem] font-bold leading-none tabular-nums"><Contador valor={dias} /></span>
        <span className="block font-bold mt-0.5">días juntos</span>
        {tiempo && <span className="block text-sm">{tiempo}</span>}
      </p>
    </Mar>
  );
}

/** '2 años y 3 meses' desde el día en que empezamos */
function tiempoJuntos(inicio: string) {
  const desde = new Date(inicio + 'T00:00:00');
  const ahora = new Date();
  let meses = (ahora.getFullYear() - desde.getFullYear()) * 12 + (ahora.getMonth() - desde.getMonth());
  if (ahora.getDate() < desde.getDate()) meses--;
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  return [
    anios > 0 && `${anios} ${anios === 1 ? 'año' : 'años'}`,
    resto > 0 && `${resto} ${resto === 1 ? 'mes' : 'meses'}`,
  ].filter(Boolean).join(' y ');
}

/** Lo de hoy primero: la pregunta, o la confirmación de que ya la respondieron los dos */
function PreguntaDeHoy({ pregunta, respondieron, racha, pareja }: { pregunta: Pregunta; respondieron: DatosInicio['respondieron']; racha: number; pareja: string }) {
  const textoRacha = racha > 0 && <><IconoFuego className="w-4 h-4" /> {racha} {racha === 1 ? 'día seguido' : 'días seguidos'}</>;

  if (respondieron.yo && respondieron.pareja) {
    return (
      <Link to="/preguntas" className="card p-4 flex items-center gap-3">
        <span className="w-11 h-11 shrink-0 rounded-full bg-seleccion text-bosque flex items-center justify-center"><IconoCheck className="w-5 h-5" /></span>
        <div className="flex-1 min-w-0">
          <p className="font-titulo text-lg font-semibold leading-tight">Los dos respondieron la pregunta de hoy</p>
          {textoRacha && <p className="text-sm font-bold text-coral flex items-center gap-1 mt-0.5">{textoRacha}</p>}
        </div>
        <IconoFlecha className="w-4 h-4 text-bosque shrink-0" />
      </Link>
    );
  }

  const quienFalta = respondieron.yo ? `Ya respondiste; ${pareja} aún no.`
    : respondieron.pareja ? `${pareja} ya respondió, falta la tuya.`
    : 'Falta la tuya.';
  return (
    <Link to="/preguntas" className="card block">
      <h2 className="text-[1.65rem] font-semibold leading-[1.15]">{pregunta.texto}</h2>
      <p className="text-sm text-salvia mt-2">La pregunta de hoy. {quienFalta}</p>
      <div className="flex items-center justify-between gap-3 mt-4">
        {textoRacha ? <span className="text-sm font-bold text-coral flex items-center gap-1">{textoRacha}</span> : <span />}
        <span className={respondieron.yo ? 'btn-soft' : 'btn-primary'}>{respondieron.yo ? 'Ver' : 'Responder'} <IconoFlecha /></span>
      </div>
    </Link>
  );
}

/** Una carta esperando es un sobre, no un aviso más */
function CartasPorAbrir({ cuantas, pareja }: { cuantas: number; pareja: string }) {
  const una = cuantas === 1;
  return (
    <Link to="/cartas" className="sobre" data-estado="nueva">
      <SolapaSobre />
      <p className="font-titulo italic font-medium text-2xl leading-tight mt-4">Tienes {cuantas} {una ? 'carta' : 'cartas'} por abrir</p>
      <p className="text-sm text-salvia mt-1">{pareja} te {una ? 'la' : 'las'} dejó. Toca para ir a {una ? 'abrirla' : 'abrirlas'}.</p>
    </Link>
  );
}

/** Lo que está esperando a que hagamos algo. Si no hay nada, el bloque no ocupa espacio */
function Pendientes({ datos, pareja, soyEl }: { datos: DatosInicio; pareja: string; soyEl: boolean }) {
  const { perfil } = useAuth();
  const { config, citaSinRecuerdo, valesPorCumplir } = datos;
  const [anioResumen] = useState(anioDelResumen);
  const fechaEspecial = config ? proximaFechaEspecial(config, soyEl) : undefined;
  const esMesiversarioHoy = fechaEspecial?.dias === 0 && fechaEspecial.texto.startsWith('nuestro');
  const diasSinGuardarCopia = config ? diasSinCopia(config.ultima_copia) : null;
  const tocaCopia = !!perfil?.esAdmin && !!config && (diasSinGuardarCopia ?? DIAS_ENTRE_COPIAS) >= DIAS_ENTRE_COPIAS;

  return (
    <div className="flex flex-col gap-2 empty:hidden">
      {/* flores (temporal) */}
      <AvisoFlores />
      {citaSinRecuerdo && <GuardarComoRecuerdo cita={citaSinRecuerdo} />}
      {anioResumen && (
        <FilaAviso to={`/resumen?anio=${anioResumen}`} Icono={IconoDestello}>Nuestro {anioResumen} en resumen ya está listo</FilaAviso>
      )}
      {/* Solo el admin: lleva 30 días (o nunca) sin descargar la copia de seguridad */}
      {tocaCopia && (
        <FilaAviso to="/historia" state={{ copia: true }} Icono={IconoDescarga}>
          {diasSinGuardarCopia != null ? `Hace ${diasSinGuardarCopia} días no guardas una copia de nuestros recuerdos` : 'Aún no has guardado una copia de nuestros recuerdos'}
        </FilaAviso>
      )}
      {perfil && <AvisoDiaImportante yo={perfil.id} pareja={pareja} />}
      {valesPorCumplir > 0 && (
        <FilaAviso to="/juntos?tab=cupones" Icono={IconoVale}>
          {valesPorCumplir === 1 ? `${pareja} usó un cupón: te toca cumplirlo` : `${pareja} usó ${valesPorCumplir} cupones: te toca cumplirlos`}
        </FilaAviso>
      )}
      <RetoDelMes compacto />
      {esMesiversarioHoy && (
        <FilaAviso to="/pelicula?desde=mes" Icono={IconoPlay}>Hoy cumplimos: vean la película de este mes 🎬</FilaAviso>
      )}
      <AvisoNotificaciones />
    </div>
  );
}

/** En diciembre se muestra el resumen del año que termina; en enero, el del que acaba de terminar */
function anioDelResumen() {
  const hoy = new Date();
  if (hoy.getMonth() === 11) return hoy.getFullYear();
  if (hoy.getMonth() === 0) return hoy.getFullYear() - 1;
  return null;
}

function GuardarComoRecuerdo({ cita }: { cita: Cita }) {
  const lugar = nombreLugar(cita);
  return (
    <Link to="/historia" state={{ cita: cita.id }} className="fila-aviso min-h-14 bg-durazno/20 border-durazno/50">
      <IconoCamara className="w-5 h-5 text-coral shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-tight">¿Cómo nos fue? Guardémosla como recuerdo</p>
        {lugar && <p className="text-sm text-salvia truncate">{lugar}</p>}
      </div>
      <IconoFlecha className="w-4 h-4 text-coral" />
    </Link>
  );
}

function FilaAviso({ to, state, Icono, children }: { to: string; state?: object; Icono: typeof IconoVale; children: React.ReactNode }) {
  return (
    <Link to={to} state={state} className="fila-aviso min-h-14">
      <Icono className="w-5 h-5 text-bosque shrink-0" />
      <p className="flex-1 font-bold text-sm">{children}</p>
      <IconoFlecha className="w-4 h-4 text-bosque" />
    </Link>
  );
}

// Juntos no está en la barra de abajo: se entra por aquí (Canciones queda en su pestaña)
const ATAJOS = [
  { to: '/juntos', Icono: IconoLista, label: 'Planes' },
  { to: '/juntos?tab=cupones', Icono: IconoVale, label: 'Cupones' },
  { to: '/juntos?tab=pelis', Icono: IconoPeli, label: 'Pelis' },
  { to: '/juntos?tab=regalos', Icono: IconoRegalo, label: 'Regalos' },
];

function AtajosAJuntos() {
  return (
    <nav className="grid grid-cols-4 gap-2" aria-label="Juntos">
      {ATAJOS.map(({ to, Icono, label }) => (
        <Link key={to} to={to} className="acceso">
          <span className="acceso-icono text-bosque"><Icono className="w-6 h-6" /></span>
          {label}
        </Link>
      ))}
    </nav>
  );
}

function useNumeroEnElIcono(cuantos: number) {
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge) return;
    (cuantos > 0 ? nav.setAppBadge(cuantos) : nav.clearAppBadge?.())?.catch(() => {});
  }, [cuantos]);
}
