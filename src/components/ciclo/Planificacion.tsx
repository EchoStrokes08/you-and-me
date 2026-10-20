import { useState } from 'react';
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import type { Modo } from '../../lib/ciclo/tipos';
import { useAvisos } from '../../lib/avisos';
import { GraficaTemperatura, Opciones } from './comunes';
import { fechaCorta } from '../../lib/ciclo/formato';

export default function Planificacion({ ciclo, pareja }: { ciclo: Ciclo; pareja: string }) {
  const { aviso } = useAvisos();
  const a = ciclo.ajustes!;
  const p = ciclo.prediccion!;
  // "Queremos evitarlo" solo se activa después de leer y aceptar que esto no es un anticonceptivo
  const [pidiendoEvitar, setPidiendoEvitar] = useState(false);
  const [aceptoEvitar, setAceptoEvitar] = useState(false);

  const cambiarModo = async (modo: Modo) => {
    try {
      await ciclo.guardarAjustes({
        ...a, modo,
        buscandoDesde: modo === 'buscar' ? (a.modo === 'buscar' ? a.buscandoDesde : p.actual?.inicio ?? ciclo.hoy) : undefined,
        // Fuera de "buscar" no tiene sentido compartir el proceso ni avisar la ventana fértil
        compartir: modo === 'buscar' ? a.compartir : { ...a.compartir, planificacion: false },
        alertas: modo === 'buscar' ? a.alertas : { ...a.alertas, ventanaFertil: false },
        avisoEvitarAceptado: a.avisoEvitarAceptado || modo === 'evitar',
      });
      setPidiendoEvitar(false);
    } catch { aviso('No pude guardar. Revisa tu conexión.', 'error'); }
  };

  const delCiclo = p.actual ? [...ciclo.dias.values()].filter((d) => d.fecha >= p.actual!.inicio).sort((x, y) => x.fecha.localeCompare(y.fecha)) : [];
  const temps = delCiclo.filter((d) => d.temperatura != null).map((d) => ({ fecha: d.fecha, valor: d.temperatura! }));
  const lh = delCiclo.filter((d) => d.lh);

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <h2 className="text-xl font-bold">Planificación familiar</h2>
        <Opciones etiqueta="Modo" multiple={false} opciones={[['ninguno', 'No ahora'], ['buscar', 'Buscamos embarazo'], ['evitar', 'Queremos evitarlo']] as const}
          elegidas={[pidiendoEvitar ? 'evitar' : a.modo]} onCambio={(v) => {
            const m = v[0] ?? 'ninguno';
            if (m === 'evitar' && a.modo !== 'evitar' && !a.avisoEvitarAceptado) setPidiendoEvitar(true);
            else if (m !== a.modo) cambiarModo(m);
            else setPidiendoEvitar(false);
          }} />
      </section>

      {(a.modo === 'evitar' || pidiendoEvitar) && (
        <section className="card flex flex-col gap-3 border-coral" role="note" aria-labelledby="no-anti">
          <h3 id="no-anti" className="font-bold text-coral">Esta app no es un método anticonceptivo</h3>
          <p className="text-sm">Las predicciones son estimaciones para entender tu ciclo, no están certificadas para evitar un embarazo. Las apps certificadas (como Natural Cycles, aprobada por la FDA) siguen protocolos estrictos de temperatura y aun así fallan en cerca de 7 de cada 100 personas al año con el uso típico. Si quieren evitar un embarazo, usen un método eficaz y hablen con un profesional de salud.</p>
          {a.modo !== 'evitar' && (
            <>
              <label className="flex gap-3 items-start cursor-pointer">
                <input type="checkbox" className="w-6 h-6 shrink-0" checked={aceptoEvitar} onChange={(e) => setAceptoEvitar(e.target.checked)} />
                <span className="text-sm font-bold">Entiendo que no debo usarla para evitar un embarazo</span>
              </label>
              <button className="btn-soft" disabled={!aceptoEvitar} onClick={() => cambiarModo('evitar')}>Activar "Queremos evitarlo"</button>
            </>
          )}
        </section>
      )}

      {a.modo === 'buscar' && !p.sinVentana && (
        <>
          <section className="card flex flex-col gap-2" aria-labelledby="ventana">
            <h3 id="ventana" className="text-lg font-bold">Ventana fértil</h3>
            {p.fertil ? (
              <>
                <p>Del <b>{fechaCorta(p.fertil.desde)}</b> al <b>{fechaCorta(p.fertil.hasta)}</b>.</p>
                <p className="text-sm">Días de mayor probabilidad: {fechaCorta(p.fertil.masProbable[0])} a {fechaCorta(p.fertil.masProbable[1])}.</p>
                <p className="text-sm text-salvia">{p.ovulacion?.confirmada ? `La ovulación de este ciclo se confirmó el ${fechaCorta(p.ovulacion.probable)}.` : 'Se afina con pruebas de ovulación y temperatura basal.'}</p>
              </>
            ) : <p className="text-sm text-salvia">Registra tu periodo para calcularla.</p>}
          </section>
          <section className="card flex flex-col gap-3" aria-labelledby="temp">
            <h3 id="temp" className="text-lg font-bold">Temperatura basal de este ciclo</h3>
            <GraficaTemperatura puntos={temps} ovulacion={p.actual?.fuenteOvulacion?.includes('temperatura') ? p.actual.ovulacion : undefined} />
            <p className="text-xs text-salvia">Tómala al despertar, antes de levantarte y a la misma hora. Después de la ovulación sube unas décimas y se queda alta hasta el periodo (regla de 3 sobre 6). Regístrala en "Hoy" o impórtala de tu reloj o anillo.</p>
          </section>
          <section className="card flex flex-col gap-2" aria-labelledby="lh">
            <h3 id="lh" className="text-lg font-bold">Pruebas de ovulación</h3>
            {lh.length ? (
              <ul className="text-sm flex flex-col gap-1">{lh.map((d) => <li key={d.fecha}>{fechaCorta(d.fecha)}: {d.lh === 'negativo' ? 'negativa' : d.lh === 'pico' ? 'pico de LH' : 'positiva'}</li>)}</ul>
            ) : <p className="text-sm text-salvia">Empieza a hacerlas unos días antes de la ventana fértil. Una positiva suele anunciar la ovulación en las siguientes 24 a 36 horas.</p>}
          </section>
          <p className="text-sm text-salvia px-1">
            {a.compartir.planificacion ? `${pareja} ve este proceso con ustedes.` : `Si quieres que ${pareja} vea este proceso, actívalo en Compartir → Planificación familiar.`}
            {' '}Si llevan un año buscando (seis meses si tienes 35 o más), vale la pena consultar.
          </p>
        </>
      )}
      {a.modo === 'buscar' && p.sinVentana && <p className="card text-sm">Con anticonceptivo hormonal no hay ovulación que predecir. Cuando lo dejes, cámbialo en "Mi ciclo" y empiezo a calcular la ventana fértil.</p>}
    </div>
  );
}
