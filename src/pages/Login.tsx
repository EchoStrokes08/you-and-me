import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { FamiliaBallenas } from '../components/Ballena';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);

  const entrar = async () => {
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('No pude entrar 😢 revisa tu correo y contraseña');
    setEntrando(false);
  };

  return (
    <div className="relative min-h-dvh flex flex-col overflow-hidden">
      {/* Cielo y mar */}
      <div className="relative card-hero rounded-t-none rounded-b-[2.5rem] pt-[max(env(safe-area-inset-top),2.5rem)] pb-24 px-6 text-center">
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="eyebrow text-lima">Solo nosotros dos</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="text-5xl font-bold mt-2 text-white">You <span className="italic font-medium text-lima">&amp;</span> me</motion.h1>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, type: 'spring' }}
          className="mx-auto mt-8 w-56">
          <FamiliaBallenas />
        </motion.div>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        onSubmit={(e) => { e.preventDefault(); entrar(); }}
        className="card relative -mt-14 mx-5 sm:mx-auto sm:w-full sm:max-w-sm flex flex-col gap-3 p-6"
      >
        <h2 className="text-2xl font-bold text-center">Hola de nuevo</h2>
        <p className="text-sm text-salvia text-center -mt-1 mb-1">Entra a nuestro rinconcito 🌿</p>
        <label className="text-xs font-extrabold text-salvia">Correo
          <input className="input mt-1" placeholder="tu@correo.com" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="text-xs font-extrabold text-salvia">Contraseña
          <input className="input mt-1" placeholder="••••••••" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="text-sm text-coral font-bold bg-durazno/25 rounded-xl px-3 py-2">{error}</p>}
        <button type="submit" disabled={entrando} className="btn-primary mt-2">{entrando ? 'Entrando…' : 'Entrar 💚'}</button>
      </motion.form>
    </div>
  );
}
