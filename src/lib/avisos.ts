import { createContext, useContext } from 'react';

export type OpcionesDialogo = { titulo: string; texto?: string; boton?: string; peligro?: boolean };
export type OpcionesTexto = OpcionesDialogo & { placeholder?: string; inicial?: string };
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
