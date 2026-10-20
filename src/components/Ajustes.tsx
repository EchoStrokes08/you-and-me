import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAvisos } from '../lib/avisos';
import { usePendientes } from '../lib/pendientes';
import SelectorTema from './SelectorTema';
import AjustesAvisos from './AjustesAvisos';
import CambiarClave from './CambiarClave';
import PersonalizacionMascotas from './PersonalizacionMascotas';
import { Hoja, IconoAdelante, IconoAjustes, IconoCalendario, IconoCandado } from './ui';

// Hoja de ajustes del inicio: lo que se usa poco y antes ocupaba tarjetas
export default function Ajustes({ abierto, onClose }: { abierto: boolean; onClose: () => void }) {
  const { salir, perfil } = useAuth();
  const { confirmar, aviso } = useAvisos();
  const pendientes = usePendientes();

  const cerrarSesion = async () => {
    if (await confirmar({ titulo: '¿Cerrar sesión en este celular?', texto: 'Dejarán de llegarte los avisos aquí.', boton: 'Cerrar sesión' })) await salir();
  };

  return (
    <Hoja abierta={abierto} onClose={onClose} titulo="Ajustes">
      {perfil?.esAdmin && (
        <Link to="/admin" onClick={onClose} className="fila-aviso min-h-14">
          <IconoAjustes className="w-5 h-5 text-bosque shrink-0" />
          <span className="flex-1 font-bold">Panel de admin</span>
          {pendientes > 0 && <span className="badge bg-alerta text-white">{pendientes} por confirmar</span>}
          <IconoAdelante className="w-4 h-4 text-bosque" />
        </Link>
      )}
      <Link to="/dias" onClick={onClose} className="fila-aviso min-h-14">
        <IconoCalendario className="w-5 h-5 text-bosque shrink-0" />
        <span className="flex-1 font-bold">Días que no puedo e importantes</span>
        <IconoAdelante className="w-4 h-4 text-bosque" />
      </Link>
      {/* Discreto a propósito: no está en el inicio, donde cualquiera que vea el celular lo vería */}
      <Link to="/ciclo" onClick={onClose} className="fila-aviso min-h-14">
        <IconoCandado className="w-5 h-5 text-bosque shrink-0" />
        <span className="flex-1 font-bold">Ciclo</span>
        <IconoAdelante className="w-4 h-4 text-bosque" />
      </Link>
      <AjustesAvisos />
      <PersonalizacionMascotas />
      <SelectorTema />
      <CambiarClave onLista={() => aviso('Contraseña cambiada 🔐')} />
      <button onClick={cerrarSesion} className="btn-soft w-full text-coral">Cerrar sesión</button>
    </Hoja>
  );
}
