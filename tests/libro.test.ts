// Pruebas del libro: el orden de las páginas, qué preguntas y recuerdos se eligen, cómo se parte el
// texto y que el PDF quede bien armado. Supabase se mockea: aquí no se baja nada ni se dibuja.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
const { planDelLibro, mejoresPreguntas, elegirRecuerdos, preguntasSugeridas } = await import('../src/lib/libro/datos');
const { renglones } = await import('../src/lib/libro/paginas');
const { pdfDeImagenes } = await import('../src/lib/libro/pdf');
type Datos = import('../src/lib/libro/datos').DatosLibro;

const recuerdo = (id: string, fecha: string, fotos = 1) => ({
  id, titulo: id, fecha, lugar: null, descripcion: null, calificacion: 3,
  fotos: Array.from({ length: fotos }, (_, i) => `${id}/${i}.jpg`), notas: [], canciones: [],
});
const pregunta = (fecha: string, corazones = 0, largo = 5) => ({
  fecha, pregunta: `¿${fecha}?`, corazones, respuestas: [{ quien: 'Él', texto: 'x'.repeat(largo) }, { quien: 'Ella', texto: 'y' }],
});
const datos = (extra: Partial<Datos> = {}): Datos => ({
  nombres: 'Él & Ella', el: 'Él', ella: 'Ella', rango: { desde: '2026-01-01', hasta: '2026-12-31', etiqueta: '2026' },
  recuerdos: [], preguntas: [], cartas: [], canciones: [], lugares: [], cifras: [{ n: 3, txt: 'recuerdos' }], ...extra,
});
const tipos = (ps: { tipo: string }[]) => ps.map((p) => p.tipo);

describe('planDelLibro', () => {
  it('va mes por mes: separador, recuerdos con sus fotos extra y las preguntas del mes', () => {
    const plan = planDelLibro(datos({
      recuerdos: [recuerdo('a', '2026-02-10', 4), recuerdo('b', '2026-03-01')],
      preguntas: [pregunta('2026-02-11'), pregunta('2026-04-02')],
    }), { preguntas: true, cartas: false });
    expect(tipos(plan)).toEqual(['portada', 'cifras', 'mes', 'recuerdo', 'collage', 'preguntas', 'mes', 'recuerdo', 'mes', 'preguntas', 'final']);
  });

  it('una sola foto de más no hace collage; nueve fotos hacen dos', () => {
    const una = planDelLibro(datos({ recuerdos: [recuerdo('a', '2026-02-10', 2)] }), { preguntas: false, cartas: false });
    expect(tipos(una)).not.toContain('collage');
    const nueve = planDelLibro(datos({ recuerdos: [recuerdo('a', '2026-02-10', 9)] }), { preguntas: false, cartas: false });
    expect(nueve.filter((p) => p.tipo === 'collage').map((p) => (p as { fotos: string[] }).fotos.length)).toEqual([4, 4]);
  });

  it('las cartas solo entran si se piden, con su portadilla', () => {
    const d = datos({ recuerdos: [recuerdo('a', '2026-02-10')], cartas: [{ fecha: '2026-02-14', titulo: 'Hola', emoji: null, de: 'Él', para: 'Ella', contenido: 'Te quiero' }] });
    expect(tipos(planDelLibro(d, { preguntas: false, cartas: false }))).not.toContain('carta');
    expect(tipos(planDelLibro(d, { preguntas: false, cartas: true }))).toEqual(['portada', 'cifras', 'mes', 'recuerdo', 'seccion', 'carta', 'final']);
  });

  it('sin preguntas, un mes que solo tenía preguntas no aparece', () => {
    const plan = planDelLibro(datos({ recuerdos: [recuerdo('a', '2026-02-10')], preguntas: [pregunta('2026-05-01')] }), { preguntas: false, cartas: false });
    expect(plan.filter((p) => p.tipo === 'mes')).toHaveLength(1);
  });

  it('las preguntas escogidas a mano entran todas, sin tope por mes, y las demás no', () => {
    const ps = [pregunta('2026-02-01', 5), pregunta('2026-02-02'), pregunta('2026-02-03'), pregunta('2026-02-04'), pregunta('2026-03-01', 9)];
    const plan = planDelLibro(datos({ preguntas: ps }), { preguntas: true, cartas: false, elegidas: new Set(['2026-02-02', '2026-02-03', '2026-02-04', '2026-02-01']) });
    const pags = plan.filter((p) => p.tipo === 'preguntas') as { items: { fecha: string }[] }[];
    expect(pags.map((p) => p.items.map((i) => i.fecha))).toEqual([['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04']]);
    expect(plan.filter((p) => p.tipo === 'mes')).toHaveLength(1);
  });

  it('las sugeridas son las mejores de cada mes', () => {
    const ps = [pregunta('2026-02-01'), pregunta('2026-02-02', 1), pregunta('2026-02-03', 1), pregunta('2026-02-04', 1), pregunta('2026-03-01')];
    expect([...preguntasSugeridas(ps)].sort()).toEqual(['2026-02-02', '2026-02-03', '2026-02-04', '2026-03-01']);
  });

  it('la música y los lugares se reparten en páginas', () => {
    const canciones = Array.from({ length: 13 }, (_, i) => ({ titulo: `c${i}`, artista: null }));
    const plan = planDelLibro(datos({ recuerdos: [recuerdo('a', '2026-02-10')], canciones }), { preguntas: false, cartas: false });
    expect(plan.filter((p) => p.tipo === 'canciones')).toHaveLength(2);
  });
});

describe('mejoresPreguntas', () => {
  it('primero las que tienen corazón, después las más largas, y quedan en orden de fecha', () => {
    const ps = [pregunta('2026-02-01', 0, 2), pregunta('2026-02-02', 1), pregunta('2026-02-03', 0, 50), pregunta('2026-02-04', 2)];
    expect(mejoresPreguntas(ps, 3).map((p) => p.fecha)).toEqual(['2026-02-02', '2026-02-03', '2026-02-04']);
  });
});

describe('elegirRecuerdos', () => {
  it('con más del tope se quedan los mejor calificados, en orden de fecha', () => {
    const rs = [
      { ...recuerdo('a', '2026-01-01'), calificacion: 2 },
      { ...recuerdo('b', '2026-01-02'), calificacion: 5 },
      { ...recuerdo('c', '2026-01-03'), calificacion: 4 },
    ];
    expect(elegirRecuerdos(rs, 2).map((r) => r.id)).toEqual(['b', 'c']);
  });
});

describe('renglones', () => {
  const medir = { measureText: (t: string) => ({ width: t.length * 10 }) as TextMetrics };
  it('parte por palabras, respeta los saltos de línea y corta con … al llegar al máximo', () => {
    expect(renglones(medir, 'uno dos tres', 70)).toEqual(['uno dos', 'tres']);
    expect(renglones(medir, 'hola\n\nchao', 100)).toEqual(['hola', '', 'chao']);
    expect(renglones(medir, 'uno dos tres cuatro', 70, 1)).toEqual(['uno do…']);
  });
});

describe('pdfDeImagenes', () => {
  it('una página por imagen, del tamaño pedido y con la tabla de posiciones correcta', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = pdfDeImagenes([{ jpeg, ancho: 10, alto: 10 }, { jpeg, ancho: 10, alto: 10 }], 20, 20);
    const txt = new TextDecoder('latin1').decode(pdf);
    expect(txt.startsWith('%PDF-1.4')).toBe(true);
    expect(txt).toContain('/Count 2');
    expect(txt).toContain('/MediaBox [0 0 566.93 566.93]');
    expect(txt.match(/\/Subtype \/Image/g)).toHaveLength(2);
    // Cada entrada del xref apunta justo al comienzo de su objeto
    const xref = Number(txt.match(/startxref\n(\d+)/)![1]);
    const filas = txt.slice(xref).split('\n').slice(3).filter((l) => / n $/.test(l));
    filas.forEach((f, i) => expect(txt.slice(Number(f.slice(0, 10))).startsWith(`${i + 1} 0 obj`)).toBe(true));
  });

  it('sin páginas no arma nada', () => {
    expect(() => pdfDeImagenes([], 20, 20)).toThrow();
  });
});
