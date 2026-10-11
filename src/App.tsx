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

// Cada página se descarga cuando se abre (el mapa y el admin pesan bastante)
const Citas = lazy(() => import('./pages/Citas'));
const Preguntas = lazy(() => import('./pages/Preguntas'));
const Historia = lazy(() => import('./pages/Historia'));
const Lugares = lazy(() => import('./pages/Lugares'));
const Cartas = lazy(() => import('./pages/Cartas'));
const Juntos = lazy(() => import('./pages/Juntos'));
const Admin = lazy(() => import('./pages/Admin'));
const Resumen = lazy(() => import('./pages/Resumen'));
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

  if (cargando) return <Cargando />;
  if (!session) return <Login />;
  if (errorPerfil) return <PantallaError texto="No pude cargar tu perfil. Revisa tu conexión." onReintentar={reintentar} />;

  return (
    <PendientesContext.Provider value={pendientes}>
    <div className="min-h-dvh pb-32">
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
