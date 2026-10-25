// El cliente único de Supabase de la app, con los tipos de la base para que cada consulta sepa sus
// columnas (se regeneran con npm run db:tipos). Aquí también: detectar si se entró por el link de
// recuperación de contraseña y datosDe, que lanza el error de una consulta en vez de dejarlo pasar.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// El link del correo de "olvidé mi contraseña" llega con type=recovery en la URL. Se anota antes
// de crear el cliente, que la limpia apenas la lee
export const llegoPorRecuperacion = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);

// Con los tipos de la base, TypeScript sabe qué columnas trae cada consulta (se regeneran con npm run db:tipos)
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

type Respuesta<T> = { data: T; error: null } | { data: null; error: { message: string } };

/** Los datos de una respuesta de Supabase; si trae error, lo lanza para que lo maneje quien llama */
export function datosDe<T>(respuesta: Respuesta<T>): T {
  if (respuesta.error) throw respuesta.error;
  return respuesta.data;
}
