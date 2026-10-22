import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { FamiliaMascotas, Mar, Olas } from '../components/MascotaDinamica';
import { Corazon } from '../components/IconosBase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const entrar = async () => {
    setEntrando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError('No pude entrar 😢 revisa tu correo y contraseña');
    setEntrando(false);
  };

  // Manda el correo con el link para poner una contraseña nueva
  const recuperar = async () => {
    setEnviado(false);
    if (!email.trim()) return setError('Escribe tu correo arriba y vuelve a tocar aquí.');
    setError('');
    setEntrando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setEntrando(false);
    if (error) setError(error.status === 429 ? 'Ya te mandé uno hace poquito. Espera un rato antes de pedir otro.' : 'No pude mandar el correo 😢 Revisa tu conexión.');
    else setEnviado(true);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* El mar ocupa lo de arriba; las ballenas nadan sobre el borde */}
      <Mar className="rounded-none px-6 pt-[max(env(safe-area-inset-top),2.75rem)] pb-16 shadow-none">
        <h1 className="relative text-[3.5rem] leading-none font-bold text-white">You <span className="italic font-medium text-lima">&amp;</span> me</h1>
        <p className="relative mt-2 font-bold text-white">Solo nosotros dos</p>
        <div className="relative ml-auto mt-6 w-60 -mr-2">
          <FamiliaMascotas />
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
        {enviado && <p role="status" className="text-sm text-bosque font-bold bg-seleccion rounded-xl px-3 py-2">Te mandé un correo 💌 Abre el link que trae, pon tu contraseña nueva y vuelve aquí a entrar.</p>}
        <button type="submit" disabled={entrando} className="btn-primary mt-1 text-lg">
          {entrando ? 'Entrando…' : <>Entrar <Corazon className="w-5 h-5 text-lima" /></>}
        </button>
        <button type="button" onClick={recuperar} disabled={entrando} className="text-sm font-bold text-bosque min-h-11">¿Olvidaste tu contraseña?</button>
      </form>
    </div>
  );
}
