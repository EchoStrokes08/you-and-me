// Contexto de sesión de la app: guarda quién está conectado, carga su perfil desde la tabla
// perfiles junto con el permiso de admin (rpc es_admin), detecta cuando entra por un link de
// recuperación de contraseña y hace el cierre de sesión (desactivando antes su notificaciones push).
// Toda la app usa useAuth() para saber si hay sesión y quién es quien.

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, llegoPorRecuperacion } from '../lib/supabase';
import { desactivarPush } from '../lib/push';

// rol dice quién es quién (admin = él, pareja = ella); esAdmin, quién tiene el permiso (tabla permisos)
export type Perfil = { id: string; nombre: string; rol: 'admin' | 'pareja'; esAdmin: boolean };

type AuthCtx = {
  session: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  // El perfil no se pudo cargar (sin conexión, error de Supabase…)
  errorPerfil: boolean;
  reintentar: () => void;
  salir: () => Promise<void>;
  // Entró con el link del correo de recuperación: antes de la app va la pantalla de contraseña nueva
  recuperando: boolean;
  terminarRecuperacion: () => void;
};

const Ctx = createContext<AuthCtx>({ session: null, perfil: null, cargando: true, errorPerfil: false, reintentar: () => {}, salir: async () => {}, recuperando: false, terminarRecuperacion: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState(false);
  const [intento, setIntento] = useState(0);
  const [recuperando, setRecuperando] = useState(llegoPorRecuperacion);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      // Un link de recuperación vencido no deja sesión: no hay contraseña que cambiar
      if (!data.session) setRecuperando(false);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => { setSession(s); if (e === 'PASSWORD_RECOVERY') setRecuperando(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Por id y no por session: la sesión cambia de objeto cada vez que se renueva el token
  const uid = session?.user.id;
  useEffect(() => {
    setErrorPerfil(false);
    if (!uid) { setPerfil(null); return; }
    Promise.all([
      supabase.from('perfiles').select('*').eq('id', uid).single(),
      supabase.rpc('es_admin'),
    ]).then(([{ data, error }, permiso]) => {
      if (error || !data || permiso.error) setErrorPerfil(true);
      else setPerfil({ ...data, esAdmin: permiso.data === true } as Perfil);
    });
  }, [uid, intento]);

  return (
    <Ctx.Provider value={{ session, perfil, cargando, errorPerfil, reintentar: () => setIntento((n) => n + 1), salir: async () => { await desactivarPush().catch(() => {}); await supabase.auth.signOut(); }, recuperando, terminarRecuperacion: () => setRecuperando(false) }}>
      {children}
    </Ctx.Provider>
  );
}

// El hook vive junto a su Provider a propósito
// oxlint-disable-next-line react/only-export-components
export const useAuth = () => useContext(Ctx);
