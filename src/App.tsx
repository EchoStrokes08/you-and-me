import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Citas from './pages/Citas';
import Preguntas from './pages/Preguntas';
import Historia from './pages/Historia';
import Lugares from './pages/Lugares';
import Cartas from './pages/Cartas';
import Admin from './pages/Admin';
import BottomNav from './components/BottomNav';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Cargando } from './components/ui';

function Shell() {
  const { session, perfil, cargando } = useAuth();
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    if (perfil?.rol === 'admin') {
      supabase.from('citas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').then(({ count }) => setPendientes(count ?? 0));
    }
  }, [perfil]);

  if (cargando) return <Cargando />;
  if (!session) return <Login />;

  return (
    <div className="min-h-dvh pb-32">
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/citas" element={<Citas />} />
        <Route path="/preguntas" element={<Preguntas />} />
        <Route path="/historia" element={<Historia />} />
        <Route path="/lugares" element={<Lugares />} />
        <Route path="/cartas" element={<Cartas />} />
        <Route path="/admin" element={perfil?.rol === 'admin' ? <Admin /> : <Navigate to="/" />} />
      </Routes>
      <BottomNav admin={perfil?.rol === 'admin'} pendientes={pendientes} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  );
}
