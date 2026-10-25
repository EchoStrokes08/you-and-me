// API de avisos para toasts, diálogos de confirmación y pedir texto en pantalla (con modo secreto
// para contraseñas). Devuelve la respuesta de Supabase tal cual si trae error. Se consume con
// useAvisos() desde cualquier componente; sin AvisosProvider arriba lanza error de inmediato.
import { createContext, useContext } from 'react';

export type OpcionesDialogo = { titulo: string; texto?: string; boton?: string; peligro?: boolean };
// secreto: para claves (no se muestra lo que se escribe)
export type OpcionesTexto = OpcionesDialogo & { placeholder?: string; inicial?: string; secreto?: boolean };
type Resultado = { error: { message?: string; code?: string } | null };

export type ApiAvisos = {
  aviso: (texto: string, tipo?: 'ok' | 'error') => void;
  confirmar: (o: OpcionesDialogo) => Promise<boolean>;
  pedirTexto: (o: OpcionesTexto) => Promise<string | null>;
  // Si la respuesta de Supabase trae error, muestra el mensaje y devuelve la misma respuesta
  revisar: <T extends Resultado>(res: T, mensaje: string) => T;
};

export const AvisosCtx = createContext<ApiAvisos | null>(null);

export const useAvisos = () => {
  const api = useContext(AvisosCtx);
  if (!api) throw new Error('useAvisos necesita <AvisosProvider>');
  return api;
};

export const sinConexion = () => typeof navigator !== 'undefined' && !navigator.onLine;
