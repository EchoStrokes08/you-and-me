import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Database } from './database.types';

type Tabla = keyof Database['public']['Tables'];

// Varios avisos seguidos (volver a la app y llegar un cambio a la vez) se juntan en una sola recarga
const ESPERA_MS = 400;

/**
 * Cuándo volver a traer los datos de una pantalla: al volver a la app (puede quedar abierta
 * de un día para otro) y cuando el otro cambia algo en alguna de estas tablas.
 * Devuelve un número que sube en cada recarga, para usarlo como dependencia de un efecto,
 * y una función para pedir una recarga a mano.
 */
export function useRecarga(canal: string, tablas: Tabla[]): [number, () => void] {
  const [vuelta, setVuelta] = useState(0);
  const recargar = useCallback(() => setVuelta((n) => n + 1), []);
  const claveTablas = tablas.join(',');

  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;
    const pedirRecarga = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(espera);
      espera = setTimeout(recargar, ESPERA_MS);
    };

    document.addEventListener('visibilitychange', pedirRecarga);
    const ch = supabase.channel(canal);
    for (const table of claveTablas.split(',').filter(Boolean)) ch.on('postgres_changes', { event: '*', schema: 'public', table }, pedirRecarga);
    ch.subscribe();

    return () => {
      clearTimeout(espera);
      document.removeEventListener('visibilitychange', pedirRecarga);
      supabase.removeChannel(ch);
    };
  }, [canal, claveTablas, recargar]);

  return [vuelta, recargar];
}
