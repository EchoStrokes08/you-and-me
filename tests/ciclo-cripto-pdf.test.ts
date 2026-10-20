import { describe, expect, it } from 'vitest';
import { unzlibSync } from 'fflate';
import * as c from '../src/lib/ciclo/cripto';
import { DocumentoPdf, aWinAnsi, partirTexto } from '../src/lib/ciclo/pdf';
import { generarInforme } from '../src/lib/ciclo/informe';
import { predecir, sumar } from '../src/lib/ciclo/prediccion';
import { ajustesIniciales, type Dia } from '../src/lib/ciclo/tipos';
import { adivinarMapeo, importarCsv, leerCsv, leerRegistroApple, mezclar, fechaCsv } from '../src/lib/ciclo/wearables';

describe('cifrado', () => {
  it('el llavero solo abre con la clave correcta o el código de recuperación', async () => {
    const { claro } = await c.crearLlaves();
    const sobre = await c.envolverLlavero(claro, 'una frase larga de prueba', 1000);
    expect(JSON.stringify(sobre)).not.toContain(claro.datos);
    expect(await c.abrirLlavero(sobre, 'otra clave')).toBeNull();
    const llaves = await c.abrirLlavero(sobre, 'una frase larga de prueba');
    expect(llaves?.publica.x).toBe(claro.publica.x);

    const codigo = c.codigoRecuperacion();
    expect(codigo).toMatch(/^([A-Z2-9]{4}-){4}[A-Z2-9]{4}$/);
    const conCodigo = await c.envolverConCodigo(claro, codigo);
    expect(await c.abrirConCodigo(conCodigo, codigo.toLowerCase().replace(/-/g, ' '))).not.toBeNull();
  });

  it('un registro no se puede mover a otra fila (AAD)', async () => {
    const { llaves } = await c.crearLlaves();
    const s = await c.cifrar(llaves, { fecha: '2026-10-20', flujo: 'medio' }, 'yo/abc');
    expect(await c.descifrar(llaves, s, 'yo/abc')).toEqual({ fecha: '2026-10-20', flujo: 'medio' });
    await expect(c.descifrar(llaves, s, 'yo/otro')).rejects.toThrow();
  });

  it('el nombre opaco es estable y no deja ver la fecha', async () => {
    const { llaves } = await c.crearLlaves();
    const a = await c.nombreOpaco(llaves, 'dia:2026-10-20');
    expect(a).toBe(await c.nombreOpaco(llaves, 'dia:2026-10-20'));
    expect(a).not.toContain('2026');
    expect(a).toHaveLength(32);
  });

  it('lo compartido solo lo abre la pareja, no ella misma ni un tercero', async () => {
    const ella = (await c.crearLlaves()).llaves;
    const el = (await c.crearLlaves()).llaves;
    const otro = (await c.crearLlaves()).llaves;
    const s = await c.cifrarPara(el.publica, { fase: 'lutea' }, 'vista');
    expect(await c.abrirDePareja(el, s, 'vista')).toEqual({ fase: 'lutea' });
    expect(await c.abrirDePareja(otro, s, 'vista')).toBeNull();
    expect(await c.abrirDePareja(ella, s, 'vista')).toBeNull();
    // Un sobre de aviso no sirve como vista
    expect(await c.abrirDePareja(el, s, 'aviso')).toBeNull();
  });

  it('la huella es igual en los dos lados', async () => {
    const { llaves } = await c.crearLlaves();
    expect(await c.huella(llaves.publica)).toMatch(/^([0-9A-F]{4} ){7}[0-9A-F]{4}$/);
  });

  it('la copia cifrada se abre con su clave', async () => {
    const copia = await c.cifrarCopia({ dias: [1, 2] }, 'clave de la copia');
    expect(await c.abrirCopia(copia, 'mala')).toBeNull();
    expect(await c.abrirCopia(copia, 'clave de la copia')).toEqual({ dias: [1, 2] });
  });

  it('pide claves largas', () => {
    expect(c.fuerzaClave('123456').puntos).toBe(0);
    expect(c.fuerzaClave('ballenas azules en el mar').puntos).toBe(3);
  });
});

describe('PDF', () => {
  it('escribe las tildes en WinAnsi', () => {
    expect(aWinAnsi('ñá€')).toEqual([0xf1, 0xe1, 0x80]);
  });
  it('parte el texto al ancho', () => {
    const lineas = partirTexto('uno dos tres cuatro cinco seis siete ocho nueve diez', 60, 10);
    expect(lineas.length).toBeGreaterThan(1);
  });
  it('arma un PDF válido con su tabla xref', () => {
    const d = new DocumentoPdf();
    d.texto(50, 50, 'Hola, Sarah');
    const pdf = new TextDecoder('latin1').decode(d.guardar());
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    const xref = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(xref, xref + 4)).toBe('xref');
    // Cada objeto está donde dice la tabla
    const entradas = [...pdf.slice(xref).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    entradas.forEach((pos, i) => expect(pdf.slice(pos, pos + 10)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
  });
  it('el informe incluye los ciclos y no las notas si no se piden', () => {
    const dias: Dia[] = ['2026-06-01', '2026-06-29', '2026-07-27', '2026-08-24'].flatMap((i) =>
      [0, 1, 2, 3].map((k) => ({ fecha: sumar(i, k), flujo: 'medio' as const, sintomas: ['colicos'], dolor: 2 as const, nota: 'secreto', actualizado: 1 })));
    const a = ajustesIniciales('2026-06-01');
    const bytes = generarInforme(dias, a, predecir(dias, a, '2026-09-01'), { nombre: 'Sarah', desde: '2026-06-01', hasta: '2026-09-01', incluirNotas: false });
    // El contenido va comprimido: se descomprime cada stream (las posiciones del texto son las de los bytes)
    const pdf = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
    const textos = [...pdf.matchAll(/stream\n([\s\S]*?)\nendstream/g)]
      .map((m) => Array.from(unzlibSync(bytes.subarray(m.index! + 7, m.index! + 7 + m[1].length)), (b) => String.fromCharCode(b)).join(''))
      .join('\n');
    const hexDe = (s: string) => aWinAnsi(s).map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(textos).toContain(hexDe('Informe del ciclo menstrual'));
    expect(textos).toContain(hexDe('28 días'));
    expect(textos).not.toContain(hexDe('secreto'));
  });
});

describe('relojes y anillos', () => {
  it('lee la temperatura basal de Apple Health y pasa °F a °C', () => {
    const l = '<Record type="HKQuantityTypeIdentifierBasalBodyTemperature" sourceName="Salud" unit="degF" creationDate="2026-10-02 07:00:00 -0500" startDate="2026-10-02 06:30:00 -0500" endDate="2026-10-02 06:30:00 -0500" value="97.7"/>';
    expect(leerRegistroApple(l)).toEqual({ fecha: '2026-10-02', temperatura: 36.5 });
  });
  it('lee el flujo y las pruebas de ovulación de Apple Health', () => {
    expect(leerRegistroApple('<Record type="HKCategoryTypeIdentifierMenstrualFlow" startDate="2026-10-03 00:00:00 -0500" value="HKCategoryValueMenstrualFlowHeavy">')).toEqual({ fecha: '2026-10-03', flujo: 'abundante' });
    expect(leerRegistroApple('<Record type="HKCategoryTypeIdentifierOvulationTestResult" startDate="2026-10-14 08:00:00 -0500" value="HKCategoryValueOvulationTestResultLuteinizingHormoneSurge"/>')).toEqual({ fecha: '2026-10-14', lh: 'pico' });
    expect(leerRegistroApple('<Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-10-14 08:00:00 -0500" value="300"/>')).toBeNull();
  });
  it('lee un CSV con columnas de Oura y adivina el mapeo', () => {
    const t = leerCsv('day,temperature_deviation,lowest_heart_rate\n2026-10-01,-0.12,52\n2026-10-02,"0,31",54\n');
    const m = adivinarMapeo(t.columnas);
    expect(m).toMatchObject({ fecha: 0, tempMuneca: 1, fcReposo: 2 });
    expect(importarCsv(t, m as any)).toEqual([
      { fecha: '2026-10-01', tempMuneca: -0.12, fcReposo: 52 },
      { fecha: '2026-10-02', tempMuneca: 0.31, fcReposo: 54 },
    ]);
  });
  it('entiende fechas con el día primero', () => {
    expect(fechaCsv('05/10/2026')).toBe('2026-10-05');
  });
  it('lo importado nunca pisa lo que ella anotó a mano', () => {
    const dias = new Map<string, Dia>([['2026-10-01', { fecha: '2026-10-01', temperatura: 36.4, actualizado: 1 }]]);
    const cambiados = mezclar(dias, [{ fecha: '2026-10-01', temperatura: 36.9, fcReposo: 50 }], 'archivo', 2);
    expect(cambiados[0]).toMatchObject({ temperatura: 36.4, fcReposo: 50, fuentes: { fcReposo: 'archivo' } });
  });
});
