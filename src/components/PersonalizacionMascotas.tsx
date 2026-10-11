import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAvisos } from '../lib/avisos';
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
  const [primario, setPrimario] = useState<MascotaPrimariaTipo>('ballena');
  const [secundario, setSecundario] = useState<MascotaSecundariaTipo>('medusa');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase
      .from('configuracion')
      .select('componente_primario, componente_secundario')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) {
          if (data.componente_primario) setPrimario(data.componente_primario as MascotaPrimariaTipo);
          if (data.componente_secundario) setSecundario(data.componente_secundario as MascotaSecundariaTipo);
        }
      });
  }, []);

  const cambiarPrimario = async (p: MascotaPrimariaTipo) => {
    setPrimario(p);
    setGuardando(true);
    revisar(
      await supabase.rpc('guardar_mascotas', { p_primario: p }),
      'No pude guardar la mascota principal'
    );
    setGuardando(false);
  };

  const cambiarSecundario = async (s: MascotaSecundariaTipo) => {
    setSecundario(s);
    setGuardando(true);
    revisar(
      await supabase.rpc('guardar_mascotas', { p_secundario: s }),
      'No pude guardar el acompañante'
    );
    setGuardando(false);
  };

  return (
    <div className="flex flex-col gap-4 border-t border-menta/50 pt-3">
      <div>
        <p className="font-bold text-bosque mb-1">Mascota principal (Primarios)</p>
        <p className="text-xs text-salvia mb-2">Acompaña las secciones principales</p>
        <div className="grid grid-cols-2 gap-2">
          {OPCIONES_PRIMARIAS.map((o) => {
            const sel = primario === o.id;
            return (
              <button
                key={o.id}
                onClick={() => cambiarPrimario(o.id)}
                disabled={guardando}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${
                  sel ? 'border-bosque bg-seleccion' : 'border-menta bg-tarjeta'
                }`}
              >
                <MascotaPrimaria tipo={o.id} className="w-16 h-12" nadando={false} />
                <span className="text-xs font-bold">{o.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="font-bold text-bosque mb-1">Acompañante marino (Secundarios)</p>
        <p className="text-xs text-salvia mb-2">Aparece en detalles y sorpresas</p>
        <div className="grid grid-cols-3 gap-2">
          {OPCIONES_SECUNDARIAS.map((o) => {
            const sel = secundario === o.id;
            return (
              <button
                key={o.id}
                onClick={() => cambiarSecundario(o.id)}
                disabled={guardando}
                className={`p-2.5 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${
                  sel ? 'border-bosque bg-seleccion' : 'border-menta bg-tarjeta'
                }`}
              >
                <MascotaSecundaria tipo={o.id} className="w-12 h-10" nadando={false} />
                <span className="text-[11px] font-bold text-center leading-tight">{o.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
