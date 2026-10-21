import { useState } from 'react';
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import type { Ajustes } from '../../lib/ciclo/tipos';
import { ANTICONCEPTIVOS, CONDICIONES, CON_PAQUETE } from '../../lib/ciclo/catalogo';
import { useAvisos } from '../../lib/avisos';
import { hoyStr } from '../../lib/utils';
import { CampoDias, Opciones } from './comunes';
import { MAX_CICLO, MAX_PERIODO, MIN_CICLO } from '../../lib/ciclo/tipos';
import { Inyeccion, Paquete } from './Empezar';

// Lo que cambia cómo se predice: condiciones, anticonceptivo y lo que suele durar
export default function AjustesCiclo({ ciclo }: { ciclo: Ciclo }) {
  const { aviso } = useAvisos();
  const [a, setA] = useState<Ajustes>(ciclo.ajustes!);
  const [guardando, setGuardando] = useState(false);
  const cambio = JSON.stringify(a) !== JSON.stringify(ciclo.ajustes);

  const guardar = async () => {
    setGuardando(true);
    try {
      const limpio = { ...a, paquete: CON_PAQUETE(a.anticonceptivo) && a.paquete?.inicio ? a.paquete : undefined, inyeccion: a.anticonceptivo === 'inyeccion' && a.inyeccion?.ultima ? a.inyeccion : undefined, partoFecha: a.condiciones.includes('posparto') ? a.partoFecha : undefined };
      await ciclo.guardarAjustes(limpio);
      aviso('Guardado 🔒');
    } catch { aviso('No pude guardar. Revisa tu conexión.', 'error'); }
    setGuardando(false);
  };

  const p = ciclo.prediccion;
  return (
    <div className="flex flex-col gap-4">
      {p && p.nCiclos > 0 && (
        <section className="card text-sm flex flex-col gap-1">
          <p className="font-bold">Lo que aprendí de tus ciclos</p>
          <p>Duran {p.duracionMedia} días en promedio (variación de ±{p.desviacion}), el periodo {p.periodoMedio} días{p.ciclos.some((c) => c.lutea) ? ` y la fase lútea ${p.luteaMedia}` : ''}. Basado en {p.nCiclos} {p.nCiclos === 1 ? 'ciclo' : 'ciclos'}.</p>
        </section>
      )}
      <section className="card grid grid-cols-2 gap-3">
        <CampoDias etiqueta="Ciclo típico" valor={a.cicloTipico} onCambio={(n) => setA((x) => ({ ...x, cicloTipico: n }))} min={MIN_CICLO} max={MAX_CICLO} />
        <CampoDias etiqueta="Periodo típico" valor={a.periodoTipico} onCambio={(n) => setA((x) => ({ ...x, periodoTipico: n }))} min={1} max={MAX_PERIODO} />
        <p className="col-span-2 text-xs text-salvia">Solo pesan mientras hay pocos ciclos registrados; después manda lo que registras.</p>
      </section>
      <section className="card flex flex-col gap-3">
        <p className="font-bold">Condiciones</p>
        <Opciones etiqueta="Condiciones" opciones={CONDICIONES} elegidas={a.condiciones} onCambio={(v) => setA({ ...a, condiciones: v })} />
        {a.condiciones.length > 0 && <ul className="text-xs text-salvia flex flex-col gap-1">{CONDICIONES.filter(([k]) => a.condiciones.includes(k)).map(([k, , d]) => <li key={k}>{d}</li>)}</ul>}
        {a.condiciones.includes('posparto') && (
          <label className="flex flex-col gap-1"><span className="text-sm font-bold">Fecha del parto</span><input type="date" max={hoyStr()} className="input" value={a.partoFecha ?? ''} onChange={(e) => setA({ ...a, partoFecha: e.target.value || undefined })} /></label>
        )}
      </section>
      <section className="card flex flex-col gap-3">
        <p className="font-bold">Anticonceptivo</p>
        <Opciones etiqueta="Anticonceptivo" multiple={false} opciones={ANTICONCEPTIVOS} elegidas={[a.anticonceptivo]} onCambio={(v) => setA({ ...a, anticonceptivo: v[0] ?? 'ninguno' })} />
        {CON_PAQUETE(a.anticonceptivo) && <Paquete valor={a.paquete ?? { inicio: '', activos: 21, descanso: 7 }} onCambio={(paquete) => setA({ ...a, paquete })} />}
        {a.anticonceptivo === 'inyeccion' && <Inyeccion valor={a.inyeccion ?? { ultima: '', cada: 30 }} onCambio={(inyeccion) => setA({ ...a, inyeccion })} />}
      </section>
      <button className="btn-primary" disabled={!cambio || guardando} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar'}</button>
    </div>
  );
}
