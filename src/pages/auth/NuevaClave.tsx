// Pantalla para poner una contraseña nueva después del link del correo de "olvidé mi contraseña";
// quien llegue con el link ya tiene su sesión hecha, solo falta poner la clave y volver a la app.
import { useAuth } from '../../context/AuthContext';
import { useAvisos } from '../../lib/avisos';
import { FormClave } from '../../components/ajustes/CambiarClave';
import { FamiliaMascotas, Mar, Olas } from '../../components/mascotas/MascotaDinamica';

// A donde llega quien tocó el link del correo de "olvidé mi contraseña": ya entró, solo falta poner la nueva
export default function NuevaClave() {
  const { terminarRecuperacion } = useAuth();
  const { aviso } = useAvisos();
  return (
    <div className="min-h-dvh flex flex-col">
      <Mar className="rounded-none px-6 pt-[max(env(safe-area-inset-top),2.75rem)] pb-16 shadow-none">
        <h1 className="relative text-[3.5rem] leading-none font-bold text-white">You <span className="italic font-medium text-lima">&amp;</span> me</h1>
        <div className="relative ml-auto mt-6 w-60 -mr-2">
          <FamiliaMascotas />
        </div>
        <Olas className="absolute bottom-0 inset-x-0 h-7 text-crema" color="currentColor" />
      </Mar>
      <div className="flex-1 w-full max-w-sm mx-auto px-6 pt-5 pb-[max(env(safe-area-inset-bottom),1.5rem)] flex flex-col gap-4">
        <div>
          <h2 className="text-[2rem] leading-tight font-bold">Pon tu contraseña nueva</h2>
          <p className="text-salvia">Con esta vas a entrar de ahora en adelante.</p>
        </div>
        <FormClave boton="Guardar y entrar" onLista={() => { terminarRecuperacion(); aviso('Contraseña cambiada 🔐'); }} />
        <button onClick={terminarRecuperacion} className="text-sm font-bold text-salvia min-h-11">Ahora no, dejar la que tenía</button>
      </div>
    </div>
  );
}
