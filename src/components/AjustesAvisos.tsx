import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAvisos } from '../lib/avisos';
import { IconoAdelante, IconoCampana } from './ui';

// Los mismos grupos que grupo_aviso() en la migración 032. Los avisos de citas siempre llegan.
const GRUPOS = [
  ['pregunta', 'La pregunta del día', 'Cuando responde, te contesta o falta la tuya'],
  ['pienso', 'Pienso en ti', 'Cada vez que te piensa, te deja una nota de voz o lo que le gustó del día'],
  ['animo', 'Cómo se siente', 'Cuando cuenta su ánimo del día'],
  ['recuerdos', 'Recuerdos y canciones', 'Recuerdos nuevos, notas, canciones y "Un día como hoy"'],
  ['juntos', 'Planes, cupones y pelis', 'Lo que se agrega en Juntos y en el mapa, los cupones y el reto del mes'],
  ['cartas', 'Cartas y cápsulas', 'Cartas nuevas, las que ya se pueden abrir y las cápsulas'],
  ['fechas', 'Fechas especiales', 'Mesiversarios, cumpleaños y los días importantes de cada uno'],
] as const;

// En Ajustes: escoger qué avisos llegan a esta cuenta (vale para todos sus celulares)
export default function AjustesAvisos() {
  const { perfil } = useAuth();
  const { revisar } = useAvisos();
  const [abierto, setAbierto] = useState(false);
  const [silenciados, setSilenciados] = useState<string[] | null>(null);

  useEffect(() => {
    if (!perfil) return;
    supabase.from('perfiles').select('avisos_silenciados').eq('id', perfil.id).single().then(({ data }) => setSilenciados(data?.avisos_silenciados ?? []));
  }, [perfil]);

  if (!perfil || !silenciados) return null;

  // El interruptor responde al toque; si no se pudo guardar, vuelve a como estaba
  const alternar = async (grupo: string) => {
    const antes = silenciados;
    const nuevo = antes.includes(grupo) ? antes.filter((g) => g !== grupo) : [...antes, grupo];
    setSilenciados(nuevo);
    const { error } = revisar(await supabase.from('perfiles').update({ avisos_silenciados: nuevo }).eq('id', perfil.id), 'No pude guardar el cambio');
    if (error) setSilenciados(antes);
  };

  return (
    <div className="flex flex-col gap-2">
      <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="fila-aviso min-h-14 text-left">
        <IconoCampana className="w-5 h-5 text-bosque shrink-0" />
        <span className="flex-1 font-bold">Qué avisos me llegan</span>
        {silenciados.length > 0 && <span className="badge bg-seleccion text-bosque border border-menta">{silenciados.length} en silencio</span>}
        <IconoAdelante className={`w-4 h-4 text-bosque transition-transform ${abierto ? 'rotate-90' : ''}`} />
      </button>
      {abierto && (
        <div className="rounded-3xl bg-tarjeta border border-menta divide-y divide-menta/70">
          {GRUPOS.map(([grupo, titulo, detalle]) => {
            const activo = !silenciados.includes(grupo);
            return (
              <button key={grupo} role="switch" aria-checked={activo} onClick={() => alternar(grupo)} className="w-full flex items-center gap-3 text-left px-4 py-3 min-h-14">
                <span className="flex-1 min-w-0">
                  <span className="block font-bold leading-tight">{titulo}</span>
                  <span className="block text-sm text-salvia">{detalle}</span>
                </span>
                <span className={`shrink-0 w-12 h-7 rounded-full p-1 transition-colors ${activo ? 'bg-hondo' : 'bg-menta'}`} aria-hidden="true">
                  <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-5' : ''}`} />
                </span>
              </button>
            );
          })}
          <p className="px-4 py-3 text-sm text-salvia">Los avisos de las citas siempre llegan.</p>
        </div>
      )}
    </div>
  );
}
