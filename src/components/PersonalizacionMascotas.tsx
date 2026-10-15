import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAvisos } from '../lib/avisos';
import { ponerMascotas, useMascotas } from '../lib/mascotas';
import {
  MascotaPrimaria,
  MascotaSecundaria,
  OPCIONES_PRIMARIAS,
  OPCIONES_SECUNDARIAS,
  type MascotaPrimariaTipo,
  type MascotaSecundariaTipo,
} from './MascotaDinamica';

export default function PersonalizacionMascotas() {
  const { revisar } = useAvisos();
  const { primario, secundario } = useMascotas();
  const [guardando, setGuardando] = useState(false);

  const cambiarPrimario = async (p: MascotaPrimariaTipo) => {
    const antes = primario;
    ponerMascotas({ primario: p });
    setGuardando(true);
    const { error } = revisar(
      await supabase.rpc('guardar_mascotas', { p_primario: p }),
      'No pude guardar la mascota principal'
    );
    if (error) ponerMascotas({ primario: antes });
    setGuardando(false);
  };

  const cambiarSecundario = async (s: MascotaSecundariaTipo) => {
    const antes = secundario;
    ponerMascotas({ secundario: s });
    setGuardando(true);
    const { error } = revisar(
      await supabase.rpc('guardar_mascotas', { p_secundario: s }),
      'No pude guardar el acompañante'
    );
    if (error) ponerMascotas({ secundario: antes });
    setGuardando(false);
  };

  return (
    <div className="flex flex-col gap-4 border-t border-menta/50 pt-3">
      <div>
        <p className="font-bold text-bosque mb-1">Mascota principal</p>
        <p className="text-xs text-salvia mb-2">Acompaña las secciones principales</p>
        <div className="grid grid-cols-2 gap-2">
          {OPCIONES_PRIMARIAS.map((o) => {
            const sel = primario === o.id;
            return (
              <button
                key={o.id}
                onClick={() => cambiarPrimario(o.id)}
                aria-pressed={sel}
                disabled={guardando}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-[color,background-color,border-color,transform] active:scale-[0.97] ${
                  sel ? 'border-bosque bg-seleccion' : 'border-menta bg-tarjeta'
                }`}
              >
                <span className="w-16 h-12 flex items-center"><MascotaPrimaria tipo={o.id} className="w-full" nadando={false} /></span>
                <span className="text-xs font-bold">{o.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="font-bold text-bosque mb-1">Acompañante marino</p>
        <p className="text-xs text-salvia mb-2">Nada junto a la mascota principal</p>
        <div className="grid grid-cols-2 gap-2">
          {OPCIONES_SECUNDARIAS.map((o) => {
            const sel = secundario === o.id;
            return (
              <button
                key={o.id}
                onClick={() => cambiarSecundario(o.id)}
                aria-pressed={sel}
                disabled={guardando}
                className={`p-2.5 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-[color,background-color,border-color,transform] active:scale-[0.97] ${
                  sel ? 'border-bosque bg-seleccion' : 'border-menta bg-tarjeta'
                }`}
              >
                <span className="w-12 h-10 flex items-center"><MascotaSecundaria tipo={o.id} className="w-full" nadando={false} /></span>
                <span className="text-xs font-bold text-center leading-tight">{o.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
