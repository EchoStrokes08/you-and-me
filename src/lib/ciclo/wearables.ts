// Datos de relojes y anillos. Una app web no puede leer Apple Health ni conectarse sola a Oura, Garmin o Fitbit
// sin registrar una app de desarrollador en cada marca, así que se importan los archivos que esas apps exportan.
// Todo se lee aquí en el celular: el archivo nunca sale de él.
import { Unzip, UnzipInflate } from 'fflate';
import type { Dia, Flujo, ResultadoLH } from './tipos';

export type Medicion = Partial<Pick<Dia, 'temperatura' | 'tempMuneca' | 'fcReposo' | 'flujo' | 'lh'>> & { fecha: string };

// ---------- Apple Health (export.zip o export.xml) ----------
const TIPOS_APPLE: Record<string, keyof Medicion> = {
  HKQuantityTypeIdentifierBasalBodyTemperature: 'temperatura',
  HKQuantityTypeIdentifierAppleSleepingWristTemperature: 'tempMuneca',
  HKQuantityTypeIdentifierRestingHeartRate: 'fcReposo',
  HKCategoryTypeIdentifierMenstrualFlow: 'flujo',
  HKCategoryTypeIdentifierOvulationTestResult: 'lh',
};
const FLUJO_APPLE: Record<string, Flujo | undefined> = {
  HKCategoryValueMenstrualFlowLight: 'leve',
  HKCategoryValueMenstrualFlowMedium: 'medio',
  HKCategoryValueMenstrualFlowHeavy: 'abundante',
  HKCategoryValueMenstrualFlowUnspecified: 'medio',
};
const LH_APPLE: Record<string, ResultadoLH | undefined> = {
  HKCategoryValueOvulationTestResultNegative: 'negativo',
  HKCategoryValueOvulationTestResultLuteinizingHormoneSurge: 'pico',
  HKCategoryValueOvulationTestResultPositive: 'positivo',
};

const atributo = (linea: string, nombre: string) => linea.match(new RegExp(`\\b${nombre}="([^"]*)"`))?.[1];

// Una línea <Record .../> del XML de Apple → medición. La fecha es la local en que empezó
export function leerRegistroApple(linea: string): Medicion | null {
  const tipo = atributo(linea, 'type');
  const campo = tipo && TIPOS_APPLE[tipo];
  if (!campo) return null;
  const inicio = atributo(linea, 'startDate');
  const valor = atributo(linea, 'value');
  if (!inicio || valor == null) return null;
  const fecha = inicio.slice(0, 10);
  if (campo === 'flujo') { const f = FLUJO_APPLE[valor]; return f ? { fecha, flujo: f } : null; }
  if (campo === 'lh') { const r = LH_APPLE[valor]; return r ? { fecha, lh: r } : null; }
  let n = Number(valor);
  if (!Number.isFinite(n)) return null;
  // Apple guarda la unidad que la persona escogió: se pasa todo a °C
  if ((campo === 'temperatura' || campo === 'tempMuneca') && atributo(linea, 'unit') === 'degF') n = (n - 32) * 5 / 9;
  return { fecha, [campo]: Math.round(n * 100) / 100 } as Medicion;
}

// Junta varias mediciones del mismo día: temperatura y pulso, la más baja (la de reposo); flujo y LH, la más alta
export function agruparPorDia(ms: Medicion[]): Medicion[] {
  const orden = { leve: 1, medio: 2, abundante: 3, manchado: 0, negativo: 0, positivo: 1, pico: 2 } as Record<string, number>;
  const por = new Map<string, Medicion>();
  for (const m of ms) {
    const a = por.get(m.fecha) ?? { fecha: m.fecha };
    for (const k of ['temperatura', 'tempMuneca', 'fcReposo'] as const) if (m[k] != null) a[k] = a[k] == null ? m[k] : Math.min(a[k]!, m[k]!);
    if (m.flujo && (!a.flujo || orden[m.flujo] > orden[a.flujo])) a.flujo = m.flujo;
    if (m.lh && (!a.lh || orden[m.lh] > orden[a.lh])) a.lh = m.lh;
    por.set(m.fecha, a);
  }
  return [...por.values()].sort((x, y) => x.fecha.localeCompare(y.fecha));
}

// Lee el texto por pedazos sin cargar todo el archivo (el export de Apple puede pesar cientos de MB)
async function leerLineas(trozos: AsyncIterable<Uint8Array> | Iterable<Uint8Array>, alLeer: (linea: string) => void) {
  const dec = new TextDecoder();
  let resto = '';
  for await (const t of trozos) {
    resto += dec.decode(t, { stream: true });
    const lineas = resto.split('\n');
    resto = lineas.pop() ?? '';
    for (const l of lineas) alLeer(l);
  }
  resto += dec.decode();
  if (resto) alLeer(resto);
}

async function* trozosDe(archivo: Blob) {
  const lector = archivo.stream().getReader();
  for (;;) {
    const { value, done } = await lector.read();
    if (done) return;
    yield value;
  }
}

// El zip trae export.xml (o su nombre traducido) y export_cda.xml: se lee el que no es CDA
async function* xmlDelZip(archivo: Blob): AsyncGenerator<Uint8Array> {
  const cola: Uint8Array[] = [];
  let terminado = false;
  let encontrado = false;
  let error: unknown = null;
  // UnzipInflate descomprime en el mismo instante del push: después de cada pedazo la cola ya tiene lo suyo
  const unzip = new Unzip((f) => {
    if (encontrado || !/\.xml$/i.test(f.name) || /cda/i.test(f.name) || f.name.includes('__MACOSX')) return;
    encontrado = true;
    f.ondata = (err, datos, final) => {
      if (err) error = err;
      else if (datos.length) cola.push(datos);
      if (final) terminado = true;
    };
    f.start();
  });
  unzip.register(UnzipInflate);
  const lector = archivo.stream().getReader();
  for (;;) {
    while (cola.length) yield cola.shift()!;
    if (error) throw error;
    if (terminado) return;
    const { value, done } = await lector.read();
    if (done) {
      unzip.push(new Uint8Array(0), true);
      while (cola.length) yield cola.shift()!;
      if (!encontrado) throw new Error('El archivo no trae el export.xml de Salud');
      return;
    }
    unzip.push(value);
  }
}

export async function importarApple(archivo: File, alAvanzar?: (registros: number) => void): Promise<Medicion[]> {
  const ms: Medicion[] = [];
  const esZip = /\.zip$/i.test(archivo.name) || archivo.type.includes('zip');
  await leerLineas(esZip ? xmlDelZip(archivo) : trozosDe(archivo), (l) => {
    if (!l.includes('<Record')) return;
    const m = leerRegistroApple(l);
    if (m) { ms.push(m); if (ms.length % 500 === 0) alAvanzar?.(ms.length); }
  });
  return agruparPorDia(ms);
}

// ---------- CSV de Oura, Garmin, Fitbit u otra app ----------
export type TablaCsv = { columnas: string[]; filas: string[][] };

export function leerCsv(texto: string): TablaCsv {
  const limpio = texto.replace(/^﻿/, '');
  const sep = (limpio.split('\n')[0].match(/;/g)?.length ?? 0) > (limpio.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') comillas = false; else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo.trim()); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo.trim()); campo = '';
      if (fila.some((x) => x !== '')) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo.trim());
  if (fila.some((x) => x !== '')) filas.push(fila);
  return { columnas: filas[0] ?? [], filas: filas.slice(1) };
}

export type Mapeo = { fecha: number; temperatura?: number; tempMuneca?: number; fcReposo?: number };

// Adivina las columnas por el nombre; la persona puede corregirlas antes de importar
export function adivinarMapeo(columnas: string[]): Partial<Mapeo> {
  const n = columnas.map((c) => c.toLowerCase());
  const buscar = (...pats: RegExp[]) => { const i = n.findIndex((c) => pats.some((p) => p.test(c))); return i >= 0 ? i : undefined; };
  return {
    fecha: buscar(/^(day|date|fecha|summary_date|calendar date)$/, /date|fecha|day/),
    temperatura: buscar(/basal|bbt|basal body/),
    tempMuneca: buscar(/temperature.?deviation|temperature_delta|skin.?temp|desviaci[oó]n|wrist/, /temperatur/),
    fcReposo: buscar(/resting.?heart|lowest.?heart|hr_lowest|rhr|frecuencia.*reposo|resting hr/),
  };
}

// Fechas como 2026-10-01, 2026/10/01, 01/10/2026 (día primero) o 2026-10-01T07:00
export function fechaCsv(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

const numero = (s: string | undefined) => {
  if (s == null || s.trim() === '') return undefined;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

export function importarCsv(t: TablaCsv, m: Mapeo): Medicion[] {
  const ms: Medicion[] = [];
  for (const f of t.filas) {
    const fecha = fechaCsv(f[m.fecha] ?? '');
    if (!fecha) continue;
    const med: Medicion = { fecha };
    const temp = m.temperatura != null ? numero(f[m.temperatura]) : undefined;
    // Temperatura basal en °F (más de 50) se pasa a °C; fuera de rango se ignora
    if (temp != null) { const c = temp > 50 ? (temp - 32) * 5 / 9 : temp; if (c > 34 && c < 39) med.temperatura = Math.round(c * 100) / 100; }
    const mu = m.tempMuneca != null ? numero(f[m.tempMuneca]) : undefined;
    if (mu != null && Math.abs(mu) < 45) med.tempMuneca = mu;
    const fc = m.fcReposo != null ? numero(f[m.fcReposo]) : undefined;
    if (fc != null && fc > 25 && fc < 150) med.fcReposo = Math.round(fc);
    if (Object.keys(med).length > 1) ms.push(med);
  }
  return agruparPorDia(ms);
}

// Mezcla lo importado con lo registrado: nunca pisa lo que ella anotó a mano
export function mezclar(dias: Map<string, Dia>, ms: Medicion[], fuente: 'apple' | 'archivo', ahora: number): Dia[] {
  const cambiados: Dia[] = [];
  for (const m of ms) {
    const d: Dia = dias.get(m.fecha) ? { ...dias.get(m.fecha)! } : { fecha: m.fecha, actualizado: ahora };
    let cambio = false;
    for (const k of ['temperatura', 'tempMuneca', 'fcReposo', 'flujo', 'lh'] as const) {
      if (m[k] == null) continue;
      const manual = d[k] != null && (d.fuentes?.[k] ?? 'manual') === 'manual';
      if (manual || d[k] === m[k]) continue;
      (d as any)[k] = m[k];
      d.fuentes = { ...d.fuentes, [k]: fuente };
      cambio = true;
    }
    if (cambio) { d.actualizado = ahora; cambiados.push(d); }
  }
  return cambiados;
}
