import { fechaStr, hoy, diasEntre } from '../lib/utils';

type Fecha = { emoji: string; texto: string; dias: number };

// Día `dia` del mes, o el último si el mes es más corto (ej. 30 → 28 de febrero)
const enMes = (anio: number, mes: number, dia: number) =>
  new Date(anio, mes, Math.min(dia, new Date(anio, mes + 1, 0).getDate()));

function proximoMesiversario(inicio: string): Fecha | null {
  const [a, m, d] = inicio.split('-').map(Number);
  const h = hoy();
  for (let i = 0; i < 2; i++) {
    const f = enMes(h.getFullYear(), h.getMonth() + i, d);
    const meses = (f.getFullYear() - a) * 12 + (f.getMonth() - (m - 1));
    if (f >= h && meses > 0) {
      const anios = meses / 12;
      return Number.isInteger(anios)
        ? { emoji: '🎉', texto: `nuestro aniversario #${anios}`, dias: diasEntre(fechaStr(f)) }
        : { emoji: '💚', texto: `nuestro mesiversario #${meses}`, dias: diasEntre(fechaStr(f)) };
    }
  }
  return null;
}

function proximoCumple(fecha: string | null, nombre: string, esMio: boolean): Fecha | null {
  if (!fecha) return null;
  const [, m, d] = fecha.split('-').map(Number);
  const h = hoy();
  let f = enMes(h.getFullYear(), m - 1, d);
  if (f < h) f = enMes(h.getFullYear() + 1, m - 1, d);
  return { emoji: '🎂', texto: esMio ? 'tu cumpleaños' : `el cumpleaños de ${nombre}`, dias: diasEntre(fechaStr(f)) };
}

export default function ProximaFecha({ config, esAdmin }: { config: any; esAdmin: boolean }) {
  const proxima = [
    config.fecha_inicio && proximoMesiversario(config.fecha_inicio),
    proximoCumple(config.cumple_ella, config.nombre_ella, !esAdmin),
    proximoCumple(config.cumple_el, config.nombre_el, esAdmin),
  ].filter(Boolean).sort((x: any, y: any) => x.dias - y.dias)[0] as Fecha | undefined;

  if (!proxima) return null;
  const hoyEs = proxima.dias === 0;

  return (
    <div className={`card flex items-center gap-4 ${hoyEs ? 'border-2 border-esmeralda bg-seleccion' : ''}`}>
      <span className="w-14 h-14 rounded-2xl bg-crema border border-menta flex items-center justify-center text-2xl">{proxima.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="eyebrow">{hoyEs ? '¡Hoy es el día!' : 'Próxima fecha especial'}</p>
        <p className="font-titulo text-lg font-semibold leading-tight first-letter:uppercase">
          {hoyEs ? `Hoy es ${proxima.texto} 💚` : `Faltan ${proxima.dias} ${proxima.dias === 1 ? 'día' : 'días'} para ${proxima.texto}`}
        </p>
      </div>
    </div>
  );
}
