import { describe, expect, it } from 'vitest';
import { cambioTermico, ciclos, faseEn, num, patrones, periodos, predecir, proximaInyeccion, sumar } from '../src/lib/ciclo/prediccion';
import { ajustesIniciales, type Ajustes, type Dia } from '../src/lib/ciclo/tipos';

const aj = (cambios: Partial<Ajustes> = {}): Ajustes => ({ ...ajustesIniciales('2026-01-01'), ...cambios });
const dia = (fecha: string, extra: Partial<Dia> = {}): Dia => ({ fecha, actualizado: 1, ...extra });
// Periodos de `largo` días que empiezan en cada fecha
const conPeriodos = (inicios: string[], largo = 5): Dia[] =>
  inicios.flatMap((i) => Array.from({ length: largo }, (_, k) => dia(sumar(i, k), { flujo: k < 2 ? 'medio' : 'leve' })));
// Inicios separados por las duraciones dadas
const inicios = (primero: string, duraciones: number[]) => duraciones.reduce((acc, d) => [...acc, sumar(acc[acc.length - 1], d)], [primero]);

describe('periodos', () => {
  it('agrupa días seguidos de sangrado y tolera un día sin registrar', () => {
    const ds = [dia('2026-03-01', { flujo: 'abundante' }), dia('2026-03-02', { flujo: 'medio' }), dia('2026-03-04', { flujo: 'leve' })];
    expect(periodos(ds)).toEqual([{ inicio: '2026-03-01', fin: '2026-03-04', dias: 4, maxFlujo: 'abundante' }]);
  });
  it('el manchado solo no empieza un periodo', () => {
    expect(periodos([dia('2026-03-01', { flujo: 'manchado' })])).toEqual([]);
  });
  it('un sangrado a los pocos días del periodo no cuenta como periodo nuevo', () => {
    const ds = [...conPeriodos(['2026-03-01']), dia('2026-03-09', { flujo: 'leve' })];
    expect(periodos(ds).map((p) => p.inicio)).toEqual(['2026-03-01']);
  });
});

describe('predecir', () => {
  it('con ciclos regulares de 30 días predice a 30 días con confianza alta', () => {
    const is = inicios('2026-01-01', [30, 30, 30, 30, 30, 30, 30]);
    const p = predecir(conPeriodos(is), aj(), sumar(is[is.length - 1], 3));
    expect(p.duracionMedia).toBe(30);
    expect(p.proximo?.probable).toBe(sumar(is[is.length - 1], 30));
    expect(p.regularidad).toBe('regular');
    expect(p.confianza).toBe('alta');
    expect(p.enPeriodo).toBe(true);
  });

  it('aprende: pesa más los ciclos recientes que lo que dijo al empezar', () => {
    const is = inicios('2026-01-01', [33, 33, 33, 33]);
    const p = predecir(conPeriodos(is), aj({ cicloTipico: 28 }), sumar(is[is.length - 1], 10));
    expect(p.duracionMedia).toBeGreaterThanOrEqual(32);
  });

  it('con pocos datos usa lo que contó al empezar y avisa que está aprendiendo', () => {
    const p = predecir(conPeriodos(['2026-05-01']), aj({ cicloTipico: 32 }), '2026-05-10');
    expect(p.proximo?.probable).toBe('2026-06-02');
    expect(p.regularidad).toBe('aprendiendo');
    expect(p.confianza).toBe('baja');
  });

  it('ciclos irregulares dan un rango más ancho', () => {
    const regular = predecir(conPeriodos(inicios('2026-01-01', [29, 29, 29, 29, 29])), aj(), '2026-06-01');
    const irregular = predecir(conPeriodos(inicios('2026-01-01', [24, 38, 27, 41, 30])), aj(), '2026-07-01');
    expect(irregular.regularidad).toBe('irregular');
    const ancho = (p: typeof regular) => num(p.proximo!.hasta) - num(p.proximo!.desde);
    expect(ancho(irregular)).toBeGreaterThan(ancho(regular));
  });

  it('con SOP el rango es amplio aunque los ciclos registrados se parezcan', () => {
    const is = inicios('2026-01-01', [35, 35, 35]);
    const p = predecir(conPeriodos(is), aj({ condiciones: ['sop'] }), sumar(is[is.length - 1], 5));
    expect(num(p.proximo!.hasta) - num(p.proximo!.desde)).toBeGreaterThanOrEqual(14);
    expect(p.notas.join(' ')).toMatch(/SOP/);
  });

  it('con SOP un ciclo de 70 días no se descarta como error', () => {
    const is = inicios('2026-01-01', [40, 70, 45]);
    const sin = ciclos(conPeriodos(is), aj(), '2026-07-01');
    const con = ciclos(conPeriodos(is), aj({ condiciones: ['sop'] }), '2026-07-01');
    expect(sin[1].excluido).toBe('largo');
    expect(con[1].excluido).toBeUndefined();
  });

  it('posparto: solo cuentan los ciclos después del parto y la confianza es baja', () => {
    const is = inicios('2025-01-01', [28, 28, 28]);
    const despues = inicios('2026-04-01', [45, 33]);
    const p = predecir(conPeriodos([...is, ...despues]), aj({ condiciones: ['posparto'], partoFecha: '2026-01-15' }), '2026-06-01');
    expect(p.nCiclos).toBe(2);
    expect(p.confianza).toBe('baja');
  });

  it('marca el retraso cuando ya pasó el rango esperado', () => {
    const is = inicios('2026-01-01', [28, 28, 28, 28, 28, 28]);
    const ultimo = is[is.length - 1];
    const p = predecir(conPeriodos(is), aj(), sumar(ultimo, 40));
    expect(p.retraso).toBeGreaterThan(0);
    expect(faseEn(p.tramos, sumar(ultimo, 40))?.fase).toBe('premenstrual');
  });

  it('la temperatura basal confirma la ovulación y afina el próximo periodo', () => {
    const is = inicios('2026-01-01', [28, 28, 28, 28]);
    const ultimo = is[is.length - 1];
    const temps: Dia[] = [];
    for (let k = 5; k <= 20; k++) temps.push(dia(sumar(ultimo, k), { temperatura: k < 17 ? 36.3 + (k % 2) * 0.05 : 36.7 }));
    const p = predecir([...conPeriodos(is), ...temps], aj(), sumar(ultimo, 20));
    expect(p.ovulacion?.confirmada).toBe(true);
    expect(p.ovulacion?.probable).toBe(sumar(ultimo, 16));
    expect(p.proximo?.probable).toBe(sumar(ultimo, 16 + p.luteaMedia));
  });

  it('la prueba de LH positiva ubica la ovulación al día siguiente', () => {
    const p = predecir([...conPeriodos(['2026-05-01']), dia('2026-05-13', { lh: 'pico' })], aj(), '2026-05-16');
    expect(p.actual?.ovulacion).toBe('2026-05-14');
    expect(p.actual?.fuenteOvulacion).toBe('lh');
  });

  it('la ventana fértil son los 5 días antes de la ovulación más el día de la ovulación', () => {
    const is = inicios('2026-01-01', [28, 28, 28, 28, 28, 28, 28]);
    const p = predecir(conPeriodos(is), aj(), sumar(is[is.length - 1], 2));
    const ov = num(p.ovulacion!.probable);
    expect(num(p.fertil!.desde)).toBeLessThanOrEqual(ov - 5);
    expect(num(p.fertil!.hasta)).toBeGreaterThanOrEqual(ov + 1);
  });

  it('con anticonceptivo hormonal no hay ventana fértil', () => {
    const p = predecir(conPeriodos(inicios('2026-01-01', [28, 28, 28])), aj({ anticonceptivo: 'implante' }), '2026-03-20');
    expect(p.sinVentana).toBe(true);
    expect(p.fertil).toBeUndefined();
    expect(p.tramos.some((t) => t.fase === 'ovulatoria')).toBe(false);
  });

  it('con inyección mensual recuerda cuándo toca la siguiente', () => {
    const a = aj({ anticonceptivo: 'inyeccion', inyeccion: { ultima: '2026-10-03', cada: 30 } });
    expect(proximaInyeccion(a, '2026-10-20')).toEqual({ fecha: '2026-11-02', dias: 13 });
    expect(proximaInyeccion(aj(), '2026-10-20')).toBeNull();
  });

  it('con pastilla 21+7 predice el sangrado en la semana de descanso', () => {
    const p = predecir([], aj({ anticonceptivo: 'pastilla', paquete: { inicio: '2026-10-01', activos: 21, descanso: 7 } }), '2026-10-10');
    expect(p.proximo?.desde).toBe('2026-10-22');
    expect(faseEn(p.tramos, '2026-10-23')?.fase).toBe('menstrual');
    expect(faseEn(p.tramos, '2026-10-10')?.fase).toBe('hormonal');
  });

  it('las fases cubren el ciclo actual sin huecos ni cruces', () => {
    const is = inicios('2026-01-01', [28, 28, 28, 28]);
    const p = predecir(conPeriodos(is), aj(), sumar(is[is.length - 1], 1));
    for (let i = 1; i < p.tramos.length; i++) expect(p.tramos[i].desde).toBe(sumar(p.tramos[i - 1].hasta, 1));
    expect(p.tramos.map((t) => t.fase).slice(0, 5)).toEqual(['menstrual', 'folicular', 'ovulatoria', 'lutea', 'premenstrual']);
  });
});

describe('cambioTermico', () => {
  it('no detecta nada con temperaturas planas', () => {
    expect(cambioTermico(Array.from({ length: 15 }, (_, k) => ({ fecha: sumar('2026-01-01', k), valor: 36.4 })))).toBeUndefined();
  });
});

describe('patrones', () => {
  it('aprende qué síntomas suele tener en cada fase', () => {
    const is = inicios('2026-01-01', [28, 28, 28, 28]);
    const ds = conPeriodos(is).map((d) => ({ ...d, sintomas: ['colicos'], dolor: 2 as const }));
    const pts = patrones(ds, aj(), '2026-06-01');
    const menstrual = pts.find((p) => p.fase === 'menstrual');
    expect(menstrual?.frecuentes[0]).toMatchObject({ id: 'colicos', tipo: 'sintoma', frecuencia: 1 });
  });
});
