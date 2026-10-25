// El formulario de contraseña nueva: vive en Ajustes y lo reutiliza el correo de "olvidé mi contraseña".
// Traduce a español los errores típicos de Supabase (clave débil, repetida, re-autenticación).
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { sinConexion } from '../lib/avisos';
import { IconoAdelante, IconoCandado } from './ui';

// La más corta que acepta Supabase
const MINIMO = 6;

const errorClave = (e: { code?: string; message?: string }) =>
  sinConexion() ? 'No hay conexión 📡 Intenta de nuevo cuando vuelva.'
  : e.code === 'same_password' ? 'Esa ya es tu contraseña. Escribe una distinta.'
  : e.code === 'weak_password' ? 'Esa es muy fácil de adivinar. Prueba con una más larga.'
  : e.code === 'reauthentication_needed' ? 'Por seguridad, cierra sesión, vuelve a entrar y cámbiala de una.'
  : 'No pude cambiarla 😢 Intenta de nuevo.';

// Los dos campos para poner una contraseña nueva (en Ajustes y al llegar del correo de recuperación)
export function FormClave({ boton = 'Guardar contraseña', onLista }: { boton?: string; onLista: () => void }) {
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (nueva.length < MINIMO) return setError(`Tiene que tener mínimo ${MINIMO} letras o números.`);
    if (nueva !== repetida) return setError('Las dos no son iguales. Escríbelas otra vez.');
    setError('');
    setGuardando(true);
    const { error } = await supabase.auth.updateUser({ password: nueva });
    setGuardando(false);
    if (error) return setError(errorClave(error));
    setNueva('');
    setRepetida('');
    onLista();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); guardar(); }} className="flex flex-col gap-3">
      <label className="text-sm font-extrabold text-bosque-oscuro">Contraseña nueva
        <input className="input mt-1.5 font-normal" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
      </label>
      <label className="text-sm font-extrabold text-bosque-oscuro">Otra vez, para estar seguros
        <input className="input mt-1.5 font-normal" type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-coral font-bold bg-durazno/25 rounded-xl px-3 py-2">{error}</p>}
      <button type="submit" disabled={guardando || !nueva || !repetida} className="btn-primary">{guardando ? 'Guardando…' : boton}</button>
    </form>
  );
}

// En Ajustes: cambiar la contraseña de esta cuenta
export default function CambiarClave({ onLista }: { onLista: () => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="fila-aviso min-h-14 text-left">
        <IconoCandado className="w-5 h-5 text-bosque shrink-0" />
        <span className="flex-1 font-bold">Cambiar mi contraseña</span>
        <IconoAdelante className={`w-4 h-4 text-bosque transition-transform ${abierto ? 'rotate-90' : ''}`} />
      </button>
      {abierto && (
        <div className="rounded-3xl bg-tarjeta border border-menta p-4 flex flex-col gap-3">
          <p className="text-sm text-salvia">Cambia en todos tus celulares: en los otros tendrás que entrar con la nueva cuando se cierre la sesión.</p>
          <FormClave onLista={() => { setAbierto(false); onLista(); }} />
        </div>
      )}
    </div>
  );
}
