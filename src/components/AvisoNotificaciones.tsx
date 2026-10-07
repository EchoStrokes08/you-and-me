import { useEffect, useState } from 'react';
import { activarPush, estadoPush, type EstadoPush } from '../lib/push';

// Tarjeta del inicio para activar las notificaciones. Desaparece cuando ya están activas.
export default function AvisoNotificaciones() {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [activando, setActivando] = useState(false);

  useEffect(() => { estadoPush().then(setEstado).catch(() => setEstado('no-soportado')); }, []);

  if (!estado || estado === 'activo' || estado === 'no-soportado') return null;

  const activar = async () => {
    setActivando(true);
    try { setEstado(await activarPush()); } catch { setEstado('inactivo'); }
    setActivando(false);
  };

  return (
    <div className="card p-4 flex flex-col gap-3 bg-seleccion border-menta">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🔔</span>
        <div className="flex-1">
          <p className="font-bold leading-tight">Que te avise cuando pase algo</p>
          <p className="text-sm text-salvia">
            {estado === 'instalar-ios' && 'Primero instala la app: en Safari toca Compartir → "Agregar a pantalla de inicio" y ábrela desde ahí.'}
            {estado === 'bloqueado' && 'Las notificaciones están bloqueadas. Actívalas en los ajustes del celular para esta app.'}
            {estado === 'inactivo' && 'Citas nuevas o confirmadas, respuestas a la pregunta del día y recuerdos.'}
          </p>
        </div>
      </div>
      {estado === 'inactivo' && (
        <button onClick={activar} disabled={activando} className="btn-primary">{activando ? 'Activando…' : 'Activar notificaciones'}</button>
      )}
    </div>
  );
}
