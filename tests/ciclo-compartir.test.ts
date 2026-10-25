// Pruebas de src/lib/ciclo/compartir: la vista que la pareja ve según cada permiso, avisos y días difíciles.
// Sin red: arma registros de días y ajustes de mentira y llama las funciones puras.
import { describe, expect, it } from 'vitest';
import { armarVista, esDiaDificil, programarAvisos } from '../src/lib/ciclo/compartir';
import { resumenPareja, textoAviso } from '../src/lib/ciclo/acciones';
import { predecir, sumar } from '../src/lib/ciclo/prediccion';
import { ajustesIniciales, PERMISOS_NADA, type Ajustes, type Dia, type Permisos } from '../src/lib/ciclo/tipos';

const HOY = '2026-10-20';
const inicios = ['2026-07-01', '2026-07-29', '2026-08-26', '2026-09-23', '2026-10-21'].filter((i) => i <= HOY);
const dias: Dia[] = [
  ...inicios.flatMap((i) => [0, 1, 2, 3].map((k) => ({ fecha: sumar(i, k), flujo: 'medio' as const, sintomas: ['colicos'], actualizado: 1 }))),
  { fecha: HOY, animo: ['triste'], sintomas: ['cansancio'], dolor: 2, temperatura: 36.6, lh: 'negativo', nota: 'nota privada', relaciones: true, actualizado: 1 },
];
const aj = (permisos: Partial<Permisos>, extra: Partial<Ajustes> = {}): Ajustes => ({
  ...ajustesIniciales('2026-07-01'),
  compartir: { ...PERMISOS_NADA, activo: true, ...permisos },
  ...extra,
});
const vista = (a: Ajustes) => armarVista(predecir(dias, a, HOY), dias, a, HOY);

describe('lo que ve la pareja respeta cada permiso', () => {
  it('con "nada" no se arma nada', () => {
    const a = { ...ajustesIniciales('2026-07-01'), compartir: { ...PERMISOS_NADA, periodo: true, fase: true } };
    expect(armarVista(predecir(dias, a, HOY), dias, a, HOY)).toBeNull();
  });

  it('solo fechas del periodo: no van fases, ánimo, síntomas ni ventana fértil', () => {
    const v = vista(aj({ periodo: true }))!;
    expect(v.periodo?.proximo).toBeDefined();
    expect(v.fases).toBeUndefined();
    expect(v.animo).toBeUndefined();
    expect(v.sintomas).toBeUndefined();
    expect(v.fertil).toBeUndefined();
    expect(v.planificacion).toBeUndefined();
  });

  it('solo ánimo: no van fechas', () => {
    const v = vista(aj({ animo: true }))!;
    expect(v.animo).toEqual([{ fecha: HOY, valores: ['triste'] }]);
    expect(v.periodo).toBeUndefined();
    expect(v.fases).toBeUndefined();
  });

  it('nunca viajan las notas, las relaciones ni la temperatura si no hay planificación', () => {
    const texto = JSON.stringify(vista(aj({ periodo: true, fase: true, animo: true, sintomas: true, fertil: true })));
    expect(texto).not.toMatch(/nota privada|relaciones|36\.6|temperatur/);
  });

  it('sin ventana fértil, la fase no deja ver la ovulación', () => {
    const v = vista(aj({ fase: true }))!;
    expect(v.fases!.some((t) => t.fase === 'ovulatoria')).toBe(false);
    expect(v.fertil).toBeUndefined();
    // Las fases siguen cubriendo todos los días
    for (let i = 1; i < v.fases!.length; i++) expect(v.fases![i].desde).toBe(sumar(v.fases![i - 1].hasta, 1));
  });

  it('con ventana fértil sí se ve la mitad del ciclo', () => {
    const v = vista(aj({ fase: true, fertil: true }))!;
    expect(v.fases!.some((t) => t.fase === 'ovulatoria')).toBe(true);
    expect(v.fertil).toBeDefined();
  });

  it('la planificación solo se comparte si buscan embarazo', () => {
    expect(vista(aj({ planificacion: true }))!.planificacion).toBeUndefined();
    const v = vista(aj({ planificacion: true }, { modo: 'buscar' }))!;
    expect(v.planificacion?.temperaturas).toEqual([{ fecha: HOY, valor: 36.6 }]);
  });

  it('con anticonceptivo hormonal no se comparte ventana fértil aunque esté permitida', () => {
    const v = vista(aj({ fertil: true, fase: true }, { anticonceptivo: 'implante' }))!;
    expect(v.fertil).toBeUndefined();
    expect(v.permisos.fertil).toBe(false);
  });
});

describe('avisos programados', () => {
  const ahora = new Date('2026-10-01T12:00:00Z');
  const p = predecir(dias.filter((d) => d.fecha < '2026-10-01'), aj({ periodo: true }), '2026-10-01');

  it('sin compartir no se programa nada', () => {
    const a = { ...aj({ periodo: true }), compartir: PERMISOS_NADA, alertas: { ...ajustesIniciales('x').alertas, antesPeriodo: true } };
    expect(programarAvisos(p, a, ahora)).toEqual([]);
  });

  it('avisa los días pedidos antes del periodo, a las 9 a. m. de Bogotá', () => {
    const a = aj({ periodo: true }, { alertas: { ...ajustesIniciales('x').alertas, antesPeriodo: true, diasAntes: 2 } });
    const [aviso] = programarAvisos(p, a, ahora);
    expect(aviso.enviarEn).toBe(`${sumar(p.proximo!.desde, -2)}T14:00:00.000Z`);
    expect(aviso.contenido).toMatchObject({ tipo: 'antes_periodo', dias: 2 });
  });

  it('sin permiso de fechas del periodo no hay aviso de periodo', () => {
    const a = aj({ animo: true }, { alertas: { ...ajustesIniciales('x').alertas, antesPeriodo: true, compras: true } });
    expect(programarAvisos(p, a, ahora)).toEqual([]);
  });
});

describe('vista de la pareja', () => {
  it('traduce la fase a algo que se puede hacer y usa lo que registró', () => {
    const v = vista(aj({ fase: true, sintomas: true, animo: true, periodo: true }))!;
    const r = resumenPareja(v, HOY, 'Sarah');
    expect(r.fase).toBe('premenstrual');
    expect(r.titular).toMatch(/Sarah puede sentir más cansancio/);
    expect(r.acciones.some((a) => /cena|Encárgate/.test(a.texto))).toBe(true);
    expect(r.acciones.some((a) => /Escúchala/.test(a.texto))).toBe(true);
    expect(r.proximo).toMatch(/podría llegar mañana/);
  });

  it('sin fases no inventa una', () => {
    const v = vista(aj({ animo: true }))!;
    const r = resumenPareja(v, HOY, 'Sarah');
    expect(r.fase).toBeUndefined();
    expect(r.contexto).toBeUndefined();
  });

  it('los avisos se leen bien', () => {
    expect(textoAviso({ tipo: 'necesidad', id: 'espacio' }, 'Sarah').titulo).toBe('Sarah necesita espacio');
    expect(textoAviso({ tipo: 'compras', productos: 'toallas e ibuprofeno', fecha: HOY }, 'Sarah').texto).toMatch(/toallas e ibuprofeno/);
  });
});

it('día difícil: dolor fuerte, o moderado con ánimo bajo', () => {
  expect(esDiaDificil({ fecha: HOY, dolor: 3, actualizado: 1 })).toBe(true);
  expect(esDiaDificil({ fecha: HOY, dolor: 2, animo: ['triste'], actualizado: 1 })).toBe(true);
  expect(esDiaDificil({ fecha: HOY, dolor: 2, animo: ['bien'], actualizado: 1 })).toBe(false);
});
