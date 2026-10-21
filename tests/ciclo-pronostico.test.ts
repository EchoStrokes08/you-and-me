import { describe, expect, it } from 'vitest';
import { predecir, sumar } from '../src/lib/ciclo/prediccion';
import { anillo, bandas, centro, centroDe, curvas, proximoHito, tira, type EntradaPronostico } from '../src/lib/ciclo/pronostico';
import { ajustesIniciales, type Dia } from '../src/lib/ciclo/tipos';

const conPeriodos = (inicios: string[]): Dia[] =>
  inicios.flatMap((i) => Array.from({ length: 5 }, (_, k) => ({ fecha: sumar(i, k), flujo: 'medio' as const, actualizado: 1 })));
const is = ['2026-06-01', '2026-06-29', '2026-07-27', '2026-08-24', '2026-09-21'];

const entrada = (hoy: string): EntradaPronostico => {
  const p = predecir(conPeriodos(is), ajustesIniciales('2026-01-01'), hoy);
  return { hoy, tramos: p.tramos, inicioCiclo: p.actual?.inicio, proximo: p.proximo, retraso: p.retraso, enPeriodo: p.enPeriodo, fertil: p.fertil };
};

describe('pronóstico', () => {
  it('el anillo es una vuelta alrededor de hoy, con lo que viene a la derecha', () => {
    const a = anillo(entrada('2026-10-01'))!;
    expect(a.diaCiclo).toBe(11);
    expect(a.largo).toBe(28);
    expect(a.dias).toHaveLength(28);
    const iHoy = a.dias.findIndex((d) => d.hoy);
    expect(iHoy).toBe(12);
    // Los días antes del inicio se cuentan como el final del ciclo anterior
    expect(a.dias[0].fecha).toBe('2026-09-19');
    expect(a.dias[0].fase).toBe('premenstrual');
  });

  it('si el día que se mira en la tira queda fuera, la vuelta avanza sin cambiar de tamaño', () => {
    const e = entrada('2026-10-01');
    const a = anillo(e, '2026-10-20')!;
    expect(a.dias).toHaveLength(28);
    expect(a.dias[a.dias.length - 1].fecha).toBe('2026-10-20');
    expect(a.dias.some((d) => d.hoy)).toBe(true);
    // Dentro de la vuelta no se mueve nada
    expect(anillo(e, '2026-10-05')!.dias[0].fecha).toBe('2026-09-19');
  });

  it('el centro de otro día dice qué fase es y cuánto falta', () => {
    const e = entrada('2026-10-01');
    const c = centroDe(e, '2026-10-03');
    expect(c.detalle).toContain('En 2 días');
    expect(c.detalle).toContain('día 13 del ciclo');
    expect(c.fase).toBeDefined();
    expect(centroDe(e, '2026-09-30').detalle).toContain('Ayer');
  });

  it('al final del ciclo el próximo periodo ya se ve en el anillo', () => {
    const a = anillo(entrada('2026-10-17'))!;
    expect(a.dias.some((d) => !d.pasado && d.fase === 'menstrual')).toBe(true);
  });

  it('sin la mitad del ciclo compartida, tampoco aparece antes del inicio', () => {
    const e = entrada('2026-09-23');
    const sinMitad = { ...e, tramos: e.tramos.filter((t) => t.fase !== 'ovulatoria') };
    expect(anillo(sinMitad)!.dias.some((d) => d.fase === 'ovulatoria')).toBe(false);
  });

  it('con un retraso el centro lo dice', () => {
    const e = entrada('2026-10-25');
    expect(centro(e, false).grande).toMatch(/tarde/);
    // A la pareja no se le cuenta el número de días
    expect(centro(e, true).grande).toBe('se demora');
  });

  it('la tira va una semana atrás y tres adelante, con curvas en cada día con fase', () => {
    const e = entrada('2026-10-05');
    const ds = tira(e);
    expect(ds[0].fecha).toBe('2026-09-28');
    expect(ds[ds.length - 1].fecha).toBe('2026-10-26');
    expect(ds.every((d) => d.fase)).toBe(true);
    const c = curvas(e, ds);
    expect(c.energia.every((v) => v != null && v >= 0 && v <= 1)).toBe(true);
    expect(bandas(ds).reduce((n, b) => n + b.largo, 0)).toBe(ds.length);
  });

  it('sin ventana fértil compartida, el próximo hito no la nombra', () => {
    const e = { ...entrada('2026-09-27'), fertil: undefined };
    expect(proximoHito(e) ?? '').not.toMatch(/fértil/);
    expect(proximoHito(entrada('2026-09-27'))).toMatch(/ventana fértil/);
  });
});
