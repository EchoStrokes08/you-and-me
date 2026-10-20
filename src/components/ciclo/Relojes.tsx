import { useState } from 'react';
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import { adivinarMapeo, importarApple, importarCsv, leerCsv, mezclar, type Mapeo, type Medicion, type TablaCsv } from '../../lib/ciclo/wearables';
import { useAvisos } from '../../lib/avisos';
import { fechaCorta } from '../../lib/ciclo/formato';

const COMO: [string, string][] = [
  ['Apple Health (iPhone y Apple Watch)', 'En la app Salud, toca tu foto → "Exportar todos los datos de salud". Te queda un archivo .zip: súbelo aquí tal cual. Trae temperatura basal, temperatura de la muñeca al dormir, pulso en reposo, periodo y pruebas de ovulación.'],
  ['Oura', 'Desde tu cuenta de Oura en la web busca la opción de exportar datos y descarga el CSV diario: trae la desviación de temperatura y el pulso más bajo de la noche.'],
  ['Garmin', 'En Garmin Connect, desde la web, pide la exportación de datos de tu cuenta o descarga el informe de pulso en reposo como CSV; si tu reloj mide temperatura de la piel, también sirve.'],
  ['Fitbit / Google', 'En Google Takeout escoge Fitbit, descarga el .zip y busca los archivos CSV de temperatura de la piel o de pulso en reposo; súbelos aquí uno por uno.'],
];

export default function Relojes({ ciclo }: { ciclo: Ciclo }) {
  const { aviso } = useAvisos();
  const [leyendo, setLeyendo] = useState<string | null>(null);
  const [mediciones, setMediciones] = useState<{ ms: Medicion[]; fuente: 'apple' | 'archivo' } | null>(null);
  const [tabla, setTabla] = useState<TablaCsv | null>(null);
  const [mapeo, setMapeo] = useState<Partial<Mapeo>>({});

  const apple = async (f: File) => {
    setLeyendo('Leyendo tu exportación… (puede tardar un poco si es grande)');
    try {
      const ms = await importarApple(f, (n) => setLeyendo(`Leyendo… ${n.toLocaleString('es-CO')} mediciones`));
      if (!ms.length) aviso('No encontré temperatura, pulso ni periodo en ese archivo.', 'error');
      setMediciones({ ms, fuente: 'apple' });
    } catch (e: any) { aviso(e?.message ?? 'No pude leer ese archivo', 'error'); }
    setLeyendo(null);
  };

  const csv = async (f: File) => {
    try {
      const t = leerCsv(await f.text());
      if (!t.columnas.length) throw new Error();
      setTabla(t);
      setMapeo(adivinarMapeo(t.columnas));
    } catch { aviso('No pude leer ese archivo como CSV.', 'error'); }
  };

  const prepararCsv = () => {
    if (!tabla || mapeo.fecha == null) return;
    const ms = importarCsv(tabla, mapeo as Mapeo);
    if (!ms.length) { aviso('Con esas columnas no salió ninguna medición.', 'error'); return; }
    setMediciones({ ms, fuente: 'archivo' });
    setTabla(null);
  };

  const confirmar = async () => {
    if (!mediciones) return;
    const cambiados = mezclar(ciclo.dias, mediciones.ms, mediciones.fuente, Date.now());
    setLeyendo('Guardando cifrado…');
    try {
      await ciclo.guardarVarios(cambiados);
      aviso(cambiados.length ? `Listo: ${cambiados.length} días actualizados 🔒` : 'Ya tenías todo eso registrado');
      setMediciones(null);
    } catch { aviso('No pude guardar. Revisa tu conexión.', 'error'); }
    setLeyendo(null);
  };

  const resumen = mediciones && {
    desde: mediciones.ms[0]?.fecha, hasta: mediciones.ms[mediciones.ms.length - 1]?.fecha,
    temp: mediciones.ms.filter((m) => m.temperatura != null).length,
    muneca: mediciones.ms.filter((m) => m.tempMuneca != null).length,
    fc: mediciones.ms.filter((m) => m.fcReposo != null).length,
    flujo: mediciones.ms.filter((m) => m.flujo).length,
    lh: mediciones.ms.filter((m) => m.lh).length,
  };

  const columnas: [keyof Mapeo, string][] = [['fecha', 'Fecha'], ['temperatura', 'Temperatura basal'], ['tempMuneca', 'Temperatura del reloj o anillo'], ['fcReposo', 'Pulso en reposo']];

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-2">
        <h2 className="text-xl font-bold">Relojes y anillos</h2>
        <p className="text-sm">La temperatura de la noche sube después de la ovulación: con ella la predicción confirma cuándo ovulaste y acierta mucho más el próximo periodo.</p>
        <p className="text-sm text-salvia">El archivo se lee aquí, en tu celular, y solo se guarda cifrado lo que sirve para el ciclo. Lo que anotaste a mano nunca se reemplaza.</p>
      </section>

      {leyendo && <p className="card text-sm font-bold" role="status" aria-live="polite">{leyendo}</p>}

      {mediciones && resumen ? (
        <section className="card flex flex-col gap-3" aria-labelledby="importar-resumen">
          <h3 id="importar-resumen" className="text-lg font-bold">Encontré esto</h3>
          <p className="text-sm">Del {fechaCorta(resumen.desde!)} al {fechaCorta(resumen.hasta!)}:</p>
          <ul className="text-sm flex flex-col gap-1">
            {resumen.temp > 0 && <li>{resumen.temp} días con temperatura basal</li>}
            {resumen.muneca > 0 && <li>{resumen.muneca} días con temperatura del reloj o anillo</li>}
            {resumen.fc > 0 && <li>{resumen.fc} días con pulso en reposo</li>}
            {resumen.flujo > 0 && <li>{resumen.flujo} días de periodo</li>}
            {resumen.lh > 0 && <li>{resumen.lh} pruebas de ovulación</li>}
          </ul>
          <button className="btn-primary" disabled={!!leyendo} onClick={confirmar}>Agregar a mi ciclo</button>
          <button className="btn-soft" onClick={() => setMediciones(null)}>Cancelar</button>
        </section>
      ) : tabla ? (
        <section className="card flex flex-col gap-3" aria-labelledby="columnas">
          <h3 id="columnas" className="text-lg font-bold">¿Qué hay en cada columna?</h3>
          {columnas.map(([k, nombre]) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-sm font-bold">{nombre}</span>
              <select className="input" value={mapeo[k] ?? ''} onChange={(e) => setMapeo({ ...mapeo, [k]: e.target.value === '' ? undefined : Number(e.target.value) })}>
                <option value="">{k === 'fecha' ? 'Escoge una columna' : 'No está'}</option>
                {tabla.columnas.map((c, i) => <option key={i} value={i}>{c} (ej.: {tabla.filas[0]?.[i] ?? ''})</option>)}
              </select>
            </label>
          ))}
          <button className="btn-primary" disabled={mapeo.fecha == null} onClick={prepararCsv}>Revisar</button>
          <button className="btn-soft" onClick={() => setTabla(null)}>Cancelar</button>
        </section>
      ) : (
        <section className="card flex flex-col gap-3">
          <label className="btn-primary cursor-pointer">
            Subir exportación de Apple Health
            <input type="file" accept=".zip,.xml,application/zip,text/xml" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) apple(f); }} />
          </label>
          <label className="btn-soft cursor-pointer">
            Subir CSV de Oura, Garmin, Fitbit u otra
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) csv(f); }} />
          </label>
        </section>
      )}

      <section className="card flex flex-col gap-3" aria-labelledby="como">
        <h3 id="como" className="text-lg font-bold">Cómo sacar tus datos</h3>
        {COMO.map(([t, d]) => (
          <details key={t}>
            <summary className="font-bold cursor-pointer min-h-8">{t}</summary>
            <p className="text-sm mt-1">{d}</p>
          </details>
        ))}
        <p className="text-xs text-salvia">Una app web no se puede conectar directo a Salud de Apple, y conectarse sola a Oura, Garmin o Fitbit exige registrar la app con cada marca. Por eso se importan los archivos: así tampoco pasa nada por servidores de terceros.</p>
      </section>
    </div>
  );
}
