import { useState } from 'react';
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import { generarInforme, nombreArchivoInforme } from '../../lib/ciclo/informe';
import { sumar } from '../../lib/ciclo/prediccion';
import { useAvisos } from '../../lib/avisos';
import { Grupo, Interruptor, Opciones } from './comunes';
import { descargar } from '../../lib/ciclo/formato';

export default function Informe({ ciclo, yo }: { ciclo: Ciclo; yo: string }) {
  const { aviso } = useAvisos();
  const [meses, setMeses] = useState<'3' | '6' | '12' | 'todo'>('6');
  const [notas, setNotas] = useState(false);
  const [nombre, setNombre] = useState(true);
  const fechas = [...ciclo.dias.keys()].sort();

  const generar = () => {
    try {
      const desde = meses === 'todo' ? fechas[0] ?? ciclo.hoy : sumar(ciclo.hoy, -Number(meses) * 30);
      const pdf = generarInforme([...ciclo.dias.values()], ciclo.ajustes!, ciclo.prediccion!, { nombre: nombre ? yo : '', desde, hasta: ciclo.hoy, incluirNotas: notas });
      descargar(pdf as BlobPart, nombreArchivoInforme(ciclo.hoy), 'application/pdf');
    } catch { aviso('No pude armar el informe', 'error'); }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-2">
        <h2 className="text-xl font-bold">Informe para el médico</h2>
        <p className="text-sm">Un PDF con tus ciclos, cuánto duran, el sangrado, los síntomas, los patrones por fase y tus mediciones. Sirve mucho en una consulta de ginecología.</p>
        <p className="text-sm text-salvia">Se arma en tu celular: no pasa por ningún servidor. Guárdalo o compártelo solo con quien quieras.</p>
      </section>
      <section className="card flex flex-col gap-3">
        <p className="font-bold">Periodo del informe</p>
        <Opciones etiqueta="Periodo del informe" multiple={false} opciones={[['3', '3 meses'], ['6', '6 meses'], ['12', '1 año'], ['todo', 'Todo']] as const} elegidas={[meses]} onCambio={(v) => v[0] && setMeses(v[0])} />
      </section>
      <Grupo>
        <Interruptor activo={nombre} onCambio={setNombre} titulo="Poner mi nombre" />
        <Interruptor activo={notas} onCambio={setNotas} titulo="Incluir mis notas" detalle="Lo que escribiste en cada día" />
      </Grupo>
      <button className="btn-primary" disabled={!fechas.length} onClick={generar}>Descargar PDF</button>
      {!fechas.length && <p className="text-sm text-salvia text-center">Cuando registres algo, aquí podrás armar el informe.</p>}
    </div>
  );
}
