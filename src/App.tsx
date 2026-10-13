import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import BottomNav from './components/BottomNav';
import ErrorBoundary, { PantallaError } from './components/ErrorBoundary';
import { supabase } from './lib/supabase';
import { Cargando } from './components/ui';
import { AvisosProvider } from './components/Avisos';
import { MotionConfig } from 'framer-motion';
import { PendientesContext } from './lib/pendientes';
import { FondoMarino } from './components/MascotaDinamica';
import { useAvisos } from './lib/avisos';
import { subirPendientes } from './lib/recuerdosPendientes';

// Cada página se descarga cuando se abre (el mapa y el admin pesan bastante)
const Citas = lazy(() => import('./pages/Citas'));
const Preguntas = lazy(() => import('./pages/Preguntas'));
const Historia = lazy(() => import('./pages/Historia'));
const Lugares = lazy(() => import('./pages/Lugares'));
const Cartas = lazy(() => import('./pages/Cartas'));
const Juntos = lazy(() => import('./pages/Juntos'));
const Admin = lazy(() => import('./pages/Admin'));
const Resumen = lazy(() => import('./pages/Resumen'));
const Dias = lazy(() => import('./pages/Dias'));
const FloresAmarillas = lazy(() => import('./especiales/flores/FloresAmarillas')); // flores (temporal)

function Shell() {
  const { session, perfil, cargando, errorPerfil, reintentar } = useAuth();
  const { pathname } = useLocation();
  const [pendientes, setPendientes] = useState(0);
  const esAdmin = perfil?.rol === 'admin';

  // Contador de citas por confirmar en la pestaña Admin, al día con Realtime
  useEffect(() => {
    if (!esAdmin) return;
    const contar = () => supabase.from('citas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').neq('creada_por', perfil!.id).then(({ count }) => setPendientes(count ?? 0));
    contar();
    const ch = supabase.channel('pendientes-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, contar).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [esAdmin, perfil?.id]);

  // Recuerdos guardados sin señal: se suben al abrir la app, al volver a ella y cuando vuelve la conexión
  const { aviso } = useAvisos();
  const uid = perfil?.id;
  useEffect(() => {
    if (!uid) return;
    const subir = () => {
      if (document.visibilityState !== 'visible') return;
      subirPendientes(uid).then((t) => { if (t.length) aviso(t.length === 1 ? `Ya subí «${t[0]}» 📸` : `Ya subí ${t.length} recuerdos que estaban esperando 📸`); });
    };
    subir();
    window.addEventListener('online', subir);
    document.addEventListener('visibilitychange', subir);
    return () => { window.removeEventListener('online', subir); document.removeEventListener('visibilitychange', subir); };
  }, [uid, aviso]);

  if (cargando) return <Cargando />;
  if (!session) return <Login />;
  if (errorPerfil) return <PantallaError texto="No pude cargar tu perfil. Revisa tu conexión." onReintentar={reintentar} />;

  return (
    <PendientesContext.Provider value={pendientes}>
    <div className="min-h-dvh pb-32">
      <FondoMarino />
      {/* key: si una página falla, al cambiar de pestaña se intenta de nuevo */}
      <ErrorBoundary key={pathname}>
        <Suspense fallback={<Cargando />}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/citas" element={<Citas />} />
            <Route path="/preguntas" element={<Preguntas />} />
            <Route path="/historia" element={<Historia />} />
            <Route path="/lugares" element={<Lugares />} />
            <Route path="/cartas" element={<Cartas />} />
            <Route path="/juntos" element={<Juntos />} />
            <Route path="/resumen" element={<Resumen />} />
            <Route path="/dias" element={<Dias />} />
            {/* flores (temporal) */}
            <Route path="/flores" element={<FloresAmarillas />} />
            <Route path="/admin" element={esAdmin ? <Admin /> : <Navigate to="/" />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <BottomNav />
    </div>
    </PendientesContext.Provider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* Respeta "reducir movimiento" del sistema también en las animaciones de Framer Motion */}
      <MotionConfig reducedMotion="user">
      <AvisosProvider>
        <AuthProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </AuthProvider>
      </AvisosProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
