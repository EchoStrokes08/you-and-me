import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import DiasNoPuedo from '../../components/DiasNoPuedo';
import { IconoCampana } from '../../components/ui';
import { useAvisos } from '../../lib/avisos';
import { useAuth } from '../../context/AuthContext';
import { Espacio } from './espacio';
import type { Configuracion, DeLaFuncion } from '../../lib/tipos';

export function Fechas() {
  return <DiasNoPuedo />;
}

// Cada uno: en cuántos celulares tiene los avisos y qué grupos silenció
type EstadoAvisos = DeLaFuncion<'estado_notificaciones'>[number];

// Los mismos grupos que en src/components/AjustesAvisos.tsx
const GRUPOS_AVISO: Record<string, string> = {
  pregunta: 'la pregunta del día', pienso: 'pienso en ti', animo: 'el ánimo', recuerdos: 'recuerdos y canciones',
  juntos: 'planes, regalos y lugares', cartas: 'cartas y cápsulas', fechas: 'fechas especiales',
};

// En cuántos celulares tiene cada uno las notificaciones activas, y una de prueba para salir de dudas
function Notificaciones() {
  const { revisar, aviso } = useAvisos();
  const { perfil } = useAuth();
  const [filas, setFilas] = useState<EstadoAvisos[]>([]);
  useEffect(() => { supabase.rpc('estado_notificaciones').then(({ data }) => setFilas(data ?? [])); }, []);

  const probar = async (f: EstadoAvisos) => {
    const { error } = revisar(await supabase.rpc('probar_notificacion', { p_destino: f.usuario_id }), 'No pude mandar la prueba');
    if (!error) aviso(f.usuario_id === perfil?.id ? 'Enviada: debería llegarte en unos segundos 🔔' : `Enviada a ${f.nombre} 🔔`);
  };

  if (!filas.length) return null;
  return (
    <section className="card p-4 flex flex-col gap-3 mb-2">
      <p className="eyebrow">Notificaciones</p>
      {filas.map((f) => (
        <div key={f.usuario_id} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold leading-tight">{f.usuario_id === perfil?.id ? 'Tú' : f.nombre}</p>
            <p className={`text-sm ${f.celulares ? 'text-salvia' : 'font-bold text-coral'}`}>
              {f.celulares ? `Activas en ${f.celulares} ${f.celulares === 1 ? 'celular' : 'celulares'}` : 'Sin activar en ningún celular'}
            </p>
            {f.silenciados?.length > 0 && <p className="text-sm text-salvia">En silencio: {f.silenciados.map((g: string) => GRUPOS_AVISO[g] ?? g).join(', ')}</p>}
          </div>
          {f.celulares > 0 && <button onClick={() => probar(f)} className="chip px-3 text-sm shrink-0"><IconoCampana className="w-4 h-4" /> Probar</button>}
        </div>
      ))}
    </section>
  );
}

type CampoConfig = { clave: 'nombre_app' | 'nombre_ella' | 'apodo_ella' | 'nombre_el' | 'fecha_inicio' | 'cumple_ella' | 'cumple_el' | 'whatsapp' | 'whatsapp_ella' | 'color_principal'; etiqueta: string; tipo?: 'date' };

// Las etiquetas hablan de quien tiene el panel abierto
const camposConfig = (soyEl: boolean): CampoConfig[] => [
  { clave: 'nombre_app', etiqueta: 'Nombre de la app' },
  { clave: 'nombre_ella', etiqueta: soyEl ? 'Nombre de ella' : 'Tu nombre' },
  { clave: 'apodo_ella', etiqueta: soyEl ? 'Cómo le dices' : 'Cómo te dice' },
  { clave: 'nombre_el', etiqueta: soyEl ? 'Tu nombre' : 'Nombre de él' },
  { clave: 'fecha_inicio', etiqueta: 'Fecha de inicio', tipo: 'date' },
  { clave: 'cumple_ella', etiqueta: soyEl ? 'Cumpleaños de ella' : 'Tu cumpleaños', tipo: 'date' },
  { clave: 'cumple_el', etiqueta: soyEl ? 'Tu cumpleaños' : 'Cumpleaños de él', tipo: 'date' },
  { clave: 'whatsapp', etiqueta: soyEl ? 'Tu WhatsApp (sin +)' : 'WhatsApp de él (sin +)' },
  { clave: 'whatsapp_ella', etiqueta: soyEl ? 'WhatsApp de ella (sin +)' : 'Tu WhatsApp (sin +)' },
  { clave: 'color_principal', etiqueta: 'Color principal' },
];

export function Config() {
  const { revisar, aviso } = useAvisos();
  const soyEl = useAuth().perfil?.rol === 'admin';
  const [c, setC] = useState<Configuracion | null>(null);
  useEffect(() => { supabase.from('configuracion').select('*').eq('id', 1).single().then(({ data }) => setC(data)); }, []);
  const guardar = async () => {
    if (!c) return;
    // Las fechas vacías van como null (Postgres no acepta '' en una columna date)
    const datos = { ...c, cumple_ella: c.cumple_ella || null, cumple_el: c.cumple_el || null };
    const { error } = revisar(await supabase.from('configuracion').update(datos).eq('id', 1), 'No pude guardar la configuración');
    if (!error) aviso('Guardado 💚');
  };
  if (!c) return null;
  return (
    <div className="flex flex-col gap-2">
      <Notificaciones />
      {camposConfig(soyEl).map(({ clave, etiqueta, tipo }) => (
        <label key={clave} className="text-sm">{etiqueta}
          <input type={tipo ?? 'text'} value={c[clave] ?? ''} onChange={(e) => setC({ ...c, [clave]: e.target.value })} className="input mt-1" />
        </label>
      ))}
      <button onClick={guardar} className="btn-primary">Guardar</button>
      <Espacio />
    </div>
  );
}
