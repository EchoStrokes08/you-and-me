import { useEffect, useState } from 'react';
import { activarPush, estadoPush, type EstadoPush } from '../lib/push';

// Fila de "Pendientes" en el inicio para activar las notificaciones. Desaparece cuando ya están activas.
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
    <div className="fila-aviso">
      <span className="text-xl">🔔</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-tight">Que te avise cuando pase algo</p>
        {estado !== 'inactivo' && (
          <p className="text-xs text-salvia mt-0.5">
            {estado === 'instalar-ios' && 'Primero instala la app: en Safari toca Compartir → "Agregar a pantalla de inicio" y ábrela desde ahí.'}
            {estado === 'bloqueado' && 'Están bloqueadas. Actívalas en los ajustes del celular para esta app.'}
          </p>
        )}
      </div>
      {estado === 'inactivo' && (
        <button onClick={activar} disabled={activando} className="btn-primary shrink-0 py-2 px-4 text-sm rounded-full">{activando ? 'Activando…' : 'Activar'}</button>
      )}
    </div>
  );
}
