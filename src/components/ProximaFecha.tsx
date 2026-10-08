import { fechaStr, hoy, diasEntre } from '../lib/utils';

export type Fecha = { emoji: string; texto: string; dias: number; fecha: string };

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
        ? { emoji: '🎉', texto: `nuestro aniversario #${anios}`, dias: diasEntre(fechaStr(f)), fecha: fechaStr(f) }
        : { emoji: '💚', texto: `nuestro mesiversario #${meses}`, dias: diasEntre(fechaStr(f)), fecha: fechaStr(f) };
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
  return { emoji: '🎂', texto: esMio ? 'tu cumpleaños' : `el cumpleaños de ${nombre}`, dias: diasEntre(fechaStr(f)), fecha: fechaStr(f) };
}

// La fecha especial más cercana: mesiversario, aniversario o cumpleaños
export function proximaFechaEspecial(config: any, esAdmin: boolean): Fecha | undefined {
  return [
    config.fecha_inicio && proximoMesiversario(config.fecha_inicio),
    proximoCumple(config.cumple_ella, config.nombre_ella, !esAdmin),
    proximoCumple(config.cumple_el, config.nombre_el, esAdmin),
  ].filter(Boolean).sort((x: any, y: any) => x.dias - y.dias)[0] as Fecha | undefined;
}
