import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { FamiliaBallenas, Mar, Olas } from '../components/Ballena';
import { Corazon } from '../components/ui';

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
    <div className="min-h-dvh flex flex-col">
      {/* El mar ocupa lo de arriba; las ballenas nadan sobre el borde */}
      <Mar className="rounded-none px-6 pt-[max(env(safe-area-inset-top),2.75rem)] pb-16 shadow-none">
        <h1 className="relative text-[3.5rem] leading-none font-bold text-white">You <span className="italic font-medium text-lima">&amp;</span> me</h1>
        <p className="relative mt-2 font-bold text-white">Solo nosotros dos</p>
        <div className="relative ml-auto mt-6 w-60 -mr-2">
          <FamiliaBallenas />
        </div>
        <Olas className="absolute bottom-0 inset-x-0 h-7 text-crema" color="currentColor" />
      </Mar>

      <form onSubmit={(e) => { e.preventDefault(); entrar(); }} className="flex-1 w-full max-w-sm mx-auto px-6 pt-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] flex flex-col gap-4">
        <div>
          <h2 className="text-[2rem] leading-tight font-bold">Hola de nuevo</h2>
          <p className="text-salvia">Entra a nuestro rinconcito</p>
        </div>
        <label className="text-sm font-extrabold text-bosque-oscuro">Correo
          <input className="input mt-1.5 font-normal" placeholder="tu@correo.com" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="text-sm font-extrabold text-bosque-oscuro">Contraseña
          <input className="input mt-1.5 font-normal" placeholder="••••••••" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-coral font-bold bg-durazno/25 rounded-xl px-3 py-2">{error}</p>}
        <button type="submit" disabled={entrando} className="btn-primary mt-1 text-lg">
          {entrando ? 'Entrando…' : <>Entrar <Corazon className="w-5 h-5 text-lima" /></>}
        </button>
      </form>
    </div>
  );
}
