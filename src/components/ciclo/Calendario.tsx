import { useMemo, useState } from 'react';
import type { Ciclo } from '../../lib/ciclo/useCiclo';
import { periodos, sumar } from '../../lib/ciclo/prediccion';
import { Hoja, IconoAtras, IconoAdelante } from '../ui';
import { fechaDia } from '../../lib/ciclo/formato';
import RegistroDia from './RegistroDia';

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
type Marca = 'periodo' | 'previsto' | 'fertil' | 'ovulacion' | null;

export default function Calendario({ ciclo }: { ciclo: Ciclo }) {
  const [mes, setMes] = useState(() => ciclo.hoy.slice(0, 7));
  const [abierto, setAbierto] = useState<string | null>(null);
  const p = ciclo.prediccion!;
  // La ventana fértil solo se pinta si le sirve: cuando buscan o evitan un embarazo
  const conFertil = !p.sinVentana && ciclo.ajustes!.modo !== 'ninguno';

  // Qué se pinta en cada día: lo registrado manda sobre lo previsto
  const marcas = useMemo(() => {
    const m = new Map<string, Marca>();
    const pintar = (desde: string, hasta: string, marca: Marca) => { for (let f = desde; f <= hasta; f = sumar(f, 1)) if (!m.has(f)) m.set(f, marca); };
    for (const per of periodos([...ciclo.dias.values()])) pintar(per.inicio, per.fin, 'periodo');
    if (p.ovulacion && conFertil) m.set(p.ovulacion.probable, m.get(p.ovulacion.probable) ?? 'ovulacion');
    for (const c of p.ciclos) if (c.ovulacion) m.set(c.ovulacion, m.get(c.ovulacion) ?? 'ovulacion');
    // Periodos y ventanas fértiles previstos: el actual y los siguientes según las fases
    for (const t of p.tramos) {
      if (t.fase === 'menstrual' && t.desde > ciclo.hoy) pintar(t.desde, t.hasta, 'previsto');
      if (t.fase === 'ovulatoria' && conFertil && t.desde > ciclo.hoy) pintar(sumar(t.desde, -4), sumar(t.hasta, -1), 'fertil');
    }
    if (p.fertil && conFertil) pintar(p.fertil.desde, p.fertil.hasta, 'fertil');
    return m;
  }, [ciclo.dias, p, ciclo.hoy, conFertil]);

  const [a, mm] = mes.split('-').map(Number);
  const primero = new Date(a, mm - 1, 1);
  const vacios = (primero.getDay() + 6) % 7;
  const total = new Date(a, mm, 0).getDate();
  const celdas = [...Array(vacios).fill(null), ...Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`)];
  const mover = (n: number) => { const d = new Date(a, mm - 1 + n, 1); setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const titulo = primero.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button className="btn-icon" onClick={() => mover(-1)} aria-label="Mes anterior"><IconoAtras /></button>
          <h2 className="text-xl font-bold first-letter:uppercase" aria-live="polite">{titulo}</h2>
          <button className="btn-icon" onClick={() => mover(1)} aria-label="Mes siguiente"><IconoAdelante /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={titulo}>
          {DIAS.map((d, i) => <span key={i} className="eyebrow py-1" aria-hidden="true">{d}</span>)}
          {celdas.map((f, i) => {
            if (!f) return <span key={`v${i}`} />;
            const marca = marcas.get(f);
            const registro = ciclo.dias.get(f);
            const futuro = f > ciclo.hoy;
            const estilo = marca === 'periodo' ? 'bg-durazno/40 text-coral font-extrabold'
              : marca === 'previsto' ? 'border-2 border-dashed border-coral/60 text-coral'
              : marca === 'fertil' ? 'bg-seleccion text-bosque'
              : marca === 'ovulacion' ? 'bg-seleccion text-bosque ring-2 ring-esmeralda'
              : 'text-bosque-oscuro';
            const nombre = `${fechaDia(f)}${marca === 'periodo' ? ', periodo' : marca === 'previsto' ? ', periodo previsto' : marca === 'fertil' ? ', ventana fértil' : marca === 'ovulacion' ? ', ovulación' : ''}${registro ? ', con registro' : ''}`;
            return (
              <button key={f} disabled={futuro} onClick={() => setAbierto(f)} aria-label={nombre}
                className={`relative aspect-square min-h-10 rounded-full flex items-center justify-center text-sm tabular-nums disabled:cursor-default ${estilo} ${f === ciclo.hoy ? 'outline-2 outline-bosque outline-offset-1' : ''}`}>
                {Number(f.slice(8))}
                {registro && marca !== 'periodo' && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-bosque" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-salvia" aria-label="Convenciones">
          <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-durazno/40" />Periodo</li>
          <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-coral/60" />Previsto</li>
          {conFertil && <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-seleccion border border-menta" />Ventana fértil</li>}
          {conFertil && <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full ring-2 ring-esmeralda" />Ovulación</li>}
          <li className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-bosque" />Con registro</li>
        </ul>
      </section>
      <p className="text-sm text-salvia px-1">Toca un día para registrar o corregir lo que pasó.</p>
      <Hoja abierta={!!abierto} onClose={() => setAbierto(null)} titulo={abierto ? fechaDia(abierto) : ''}>
        {abierto && <RegistroDia ciclo={ciclo} fecha={abierto} onGuardado={() => setAbierto(null)} />}
      </Hoja>
    </div>
  );
}
