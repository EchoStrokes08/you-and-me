import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type Perfil = { id: string; nombre: string; rol: 'admin' | 'pareja' };

type AuthCtx = {
  session: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  salir: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ session: null, perfil: null, cargando: true, salir: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setPerfil(null); return; }
    supabase.from('perfiles').select('*').eq('id', session.user.id).single().then(({ data }) => setPerfil(data as Perfil));
  }, [session]);

  return (
    <Ctx.Provider value={{ session, perfil, cargando, salir: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
