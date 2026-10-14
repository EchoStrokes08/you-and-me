import { createClient } from '@supabase/supabase-js';

// El link del correo de "olvidé mi contraseña" llega con type=recovery en la URL. Se anota antes
// de crear el cliente, que la limpia apenas la lee
export const llegoPorRecuperacion = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
