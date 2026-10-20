import { useState } from 'react';
import { TEMAS } from '../../lib/ciclo/educacion';
import { IconoAdelante } from '../ui';

// Explicaciones cortas; quien recibe ve primero cómo acompañar
export default function Aprender({ paraPareja }: { paraPareja?: boolean }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const orden = paraPareja ? ['acompanar', 'fases', 'spm', 'dismenorrea', 'fertil', 'irregular', 'no-anticonceptivo'] : ['fases', 'spm', 'dismenorrea', 'irregular', 'fertil', 'no-anticonceptivo', 'acompanar'];
  const temas = orden.map((id) => TEMAS.find((t) => t.id === id)!).filter(Boolean);
  return (
    <div className="flex flex-col gap-3">
      {temas.map((t) => {
        const abiertoAqui = abierto === t.id;
        return (
          <section key={t.id} className="card !p-0 overflow-hidden">
            <button onClick={() => setAbierto(abiertoAqui ? null : t.id)} aria-expanded={abiertoAqui} className="w-full flex items-center gap-3 text-left p-5">
              <span className="flex-1">
                <span className="block font-titulo text-lg font-semibold leading-snug">{t.titulo}</span>
                <span className="block text-sm text-salvia">{t.resumen}</span>
              </span>
              <IconoAdelante className={`w-4 h-4 text-bosque shrink-0 transition-transform ${abiertoAqui ? 'rotate-90' : ''}`} />
            </button>
            {abiertoAqui && (
              <div className="px-5 pb-5 flex flex-col gap-3">
                {t.parrafos.map((p) => <p key={p}>{p}</p>)}
                {t.puntos && <ul className="flex flex-col gap-1 text-sm">{t.puntos.map((p) => <li key={p} className="font-bold">{p}</li>)}</ul>}
                {t.consultar && (
                  <div className="rounded-2xl bg-seleccion p-4 flex flex-col gap-1">
                    <p className="font-bold">Cuándo consultar</p>
                    <ul className="list-disc pl-5 text-sm flex flex-col gap-1">{t.consultar.map((c) => <li key={c}>{c}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
      <p className="text-xs text-salvia px-1">Información general basada en guías de ginecología. No reemplaza una consulta médica.</p>
    </div>
  );
}
