// La pantalla de planificación familiar: modo (no ahora, buscamos o evitamos), temperatura basal y pruebas de ovulación con su gráfica.
// Cambiar el modo guarda de una vez y reacomoda lo compartido y los avisos: fuera de "buscar" eso se apaga solo.
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import type { Modo } from '../../lib/ciclo/tipos';
import { useAvisos } from '../../lib/avisos';
import { GraficaTemperatura, Opciones } from './comunes';
import { fechaCorta } from '../../lib/ciclo/formato';

export default function Planificacion({ ciclo, pareja }: { ciclo: Ciclo; pareja: string }) {
  const { aviso } = useAvisos();
  const a = ciclo.ajustes!;
  const p = ciclo.prediccion!;

  const cambiarModo = async (modo: Modo) => {
    try {
      await ciclo.guardarAjustes({
        ...a, modo,
        buscandoDesde: modo === 'buscar' ? (a.modo === 'buscar' ? a.buscandoDesde : p.actual?.inicio ?? ciclo.hoy) : undefined,
        // Fuera de "buscar" no tiene sentido compartir el proceso ni avisar la ventana fértil
        compartir: modo === 'buscar' ? a.compartir : { ...a.compartir, planificacion: false },
        alertas: modo === 'buscar' ? a.alertas : { ...a.alertas, ventanaFertil: false },
      });
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
          elegidas={[a.modo]} onCambio={(v) => {
            const m = v[0] ?? 'ninguno';
            if (m !== a.modo) cambiarModo(m);
          }} />
      </section>

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
