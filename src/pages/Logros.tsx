import { useEffect, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { diasEntre } from '../lib/utils';
import Ballena from '../components/Ballena';
import Cachalote from '../components/Cachalote';
import Orca from '../components/Orca';
import Tortuga from '../components/Tortuga';
import Medusa from '../components/Medusa';
import PezPayaso from '../components/PezPayaso';
import CaballitoDeMar from '../components/CaballitoDeMar';
import TiburonBallena from '../components/TiburonBallena';
import { Encabezado, Esqueleto, IconoAtras, IconoCheck } from '../components/ui';

type Criatura = ComponentType<{ className?: string; nadando?: boolean }>;
type Logro = { clave: string; meta: number; titulo: string; texto: string; Criatura: Criatura };

// Cada logro con una criatura del mar de la app; las que faltan se ven dormidas
const LOGROS: Logro[] = [
  { clave: 'dias', meta: 100, titulo: '100 días', texto: 'Cien días juntos', Criatura: Ballena },
  { clave: 'dias', meta: 365, titulo: 'Un año', texto: 'Una vuelta entera al sol', Criatura: Cachalote },
  { clave: 'dias', meta: 1000, titulo: '1.000 días', texto: 'Mil días de nosotros', Criatura: TiburonBallena },
  { clave: 'recuerdos', meta: 1, titulo: 'Primer recuerdo', texto: 'Lo primero que guardamos', Criatura: Tortuga },
  { clave: 'recuerdos', meta: 25, titulo: 'Álbum lleno', texto: '25 recuerdos guardados', Criatura: Tortuga },
  { clave: 'fotos', meta: 100, titulo: '100 fotos', texto: 'Cien fotos de los dos', Criatura: CaballitoDeMar },
  { clave: 'citas', meta: 10, titulo: '10 citas', texto: 'Diez citas vividas', Criatura: Orca },
  { clave: 'lugares', meta: 5, titulo: 'Exploradores', texto: '5 lugares distintos', Criatura: TiburonBallena },
  { clave: 'preguntas', meta: 10, titulo: 'Conociéndonos', texto: '10 preguntas respondidas por los dos', Criatura: PezPayaso },
  { clave: 'preguntas', meta: 100, titulo: 'Nos sabemos de memoria', texto: '100 preguntas respondidas', Criatura: Medusa },
  { clave: 'cartas', meta: 1, titulo: 'Primera carta', texto: 'Una carta abierta', Criatura: Medusa },
  { clave: 'pensamientos', meta: 1000, titulo: 'Mil “pienso en ti”', texto: 'Entre los dos', Criatura: Ballena },
  { clave: 'planes', meta: 1, titulo: 'Sueño cumplido', texto: 'Un plan de la lista, hecho', Criatura: PezPayaso },
  { clave: 'retos', meta: 3, titulo: 'Retadores', texto: '3 retos del mes cumplidos', Criatura: CaballitoDeMar },
  { clave: 'vales', meta: 5, titulo: 'Palabra cumplida', texto: '5 cupones cumplidos', Criatura: Tortuga },
  { clave: 'pelis', meta: 10, titulo: 'Cinéfilos', texto: '10 pelis o series vistas', Criatura: Orca },
  { clave: 'canciones', meta: 10, titulo: 'Nuestra playlist', texto: '10 canciones nuestras', Criatura: Cachalote },
  { clave: 'gratitudes', meta: 30, titulo: 'Agradecidos', texto: '30 veces “lo que me gustó de hoy”', Criatura: Medusa },
];

export default function Logros() {
  const [conteos, setConteos] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.rpc('contar_logros'),
      supabase.from('configuracion').select('fecha_inicio').eq('id', 1).single(),
    ]).then(([{ data: l }, { data: c }]) => setConteos({ ...(l ?? {}), dias: c?.fecha_inicio ? -diasEntre(c.fecha_inicio) : 0 }));
  }, []);

  const logrados = conteos ? LOGROS.filter((l) => (conteos[l.clave] ?? 0) >= l.meta).length : 0;
  // Primero los logrados; de los que faltan, los más cerca de lograrse
  const orden = conteos ? [...LOGROS].sort((a, b) => {
    const pa = Math.min(1, (conteos[a.clave] ?? 0) / a.meta), pb = Math.min(1, (conteos[b.clave] ?? 0) / b.meta);
    return pb - pa;
  }) : LOGROS;

  return (
    <div className="p-5 max-w-lg mx-auto flex flex-col gap-4">
      <Link to="/historia" className="btn-icon" aria-label="Volver a nuestra historia"><IconoAtras /></Link>
      <Encabezado eyebrow={conteos ? `${logrados} de ${LOGROS.length} logrados` : 'Lo que hemos logrado'} titulo="Nuestros logros" />

      {!conteos ? <Esqueleto className="h-64" /> : (
        <ul className="grid grid-cols-2 gap-3 stagger">
          {orden.map((l) => {
            const valor = conteos[l.clave] ?? 0;
            const listo = valor >= l.meta;
            const progreso = Math.min(1, valor / l.meta);
            return (
              <li key={`${l.clave}-${l.meta}`} className={`card p-3 flex flex-col gap-2 ${listo ? 'border-esmeralda/40' : ''}`}>
                <div className={`relative h-20 rounded-2xl flex items-center justify-center overflow-hidden ${listo ? 'bg-gradient-to-b from-[var(--mar-1)] to-[var(--mar-3)]' : 'bg-seleccion'}`} aria-hidden="true">
                  <l.Criatura className={`w-[78%] ${listo ? '' : 'grayscale opacity-35'}`} nadando={false} />
                  {listo && <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-lima text-pino flex items-center justify-center"><IconoCheck className="w-3.5 h-3.5" /></span>}
                </div>
                <div>
                  <p className="font-titulo font-semibold leading-tight">{l.titulo}</p>
                  <p className="text-xs text-salvia leading-snug mt-0.5">{l.texto}</p>
                </div>
                {!listo && (
                  <div className="mt-auto">
                    <div className="h-1.5 rounded-full bg-menta overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={l.meta} aria-valuenow={valor} aria-label={`${l.titulo}: ${valor} de ${l.meta}`}>
                      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0.03, progreso) }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="h-full w-full origin-left bg-esmeralda rounded-full" />
                    </div>
                    <p className="text-xs font-bold text-salvia mt-1 tabular-nums">{valor.toLocaleString('es-CO')} de {l.meta.toLocaleString('es-CO')}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
