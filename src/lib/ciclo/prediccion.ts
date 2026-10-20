// Predicción del ciclo a partir de lo que ella registra. Aprende de sus propios ciclos:
// el promedio pesa más los ciclos recientes, el rango sale de cuánto varían y las condiciones
// (SOP, posparto, perimenopausia, anticonceptivos) lo ensanchan o cambian qué se puede predecir.
// La temperatura basal y las pruebas de ovulación confirman la ovulación y afinan el próximo periodo.
import type { Ajustes, Dia, Fase, Flujo, Tramo } from './tipos';
import { CON_PAQUETE, ES_HORMONAL } from './catalogo';

const MS = 86400000;
export const num = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS);
};
export const fecha = (n: number) => new Date(n * MS).toISOString().slice(0, 10);
export const sumar = (s: string, n: number) => fecha(num(s) + n);
export const entre = (a: string, b: string) => num(b) - num(a);

const ORDEN_FLUJO: Record<Flujo, number> = { manchado: 0, leve: 1, medio: 2, abundante: 3 };

export type Periodo = { inicio: string; fin: string; dias: number; maxFlujo: Flujo };
export type Ciclo = {
  inicio: string;
  duracion?: number; // hasta el siguiente periodo; sin valor si es el ciclo actual
  periodo: number;
  ovulacion?: string;
  fuenteOvulacion?: 'temperatura' | 'lh' | 'temperatura+lh';
  lutea?: number;
  excluido?: 'corto' | 'largo';
};

// Días sin sangrar que puede haber dentro de un mismo periodo
const HUECO_MAX = 2;
// Un sangrado que empieza menos de estos días después del anterior no es un periodo nuevo
const MIN_ENTRE_PERIODOS = 12;

export function periodos(dias: Dia[]): Periodo[] {
  const conFlujo = dias.filter((d) => d.flujo && d.flujo !== 'manchado').sort((a, b) => a.fecha.localeCompare(b.fecha));
  const grupos: Dia[][] = [];
  for (const d of conFlujo) {
    const g = grupos[grupos.length - 1];
    if (g && entre(g[g.length - 1].fecha, d.fecha) <= HUECO_MAX + 1) g.push(d);
    else if (g && entre(g[0].fecha, d.fecha) < MIN_ENTRE_PERIODOS) continue; // sangrado intermedio
    else grupos.push([d]);
  }
  return grupos.map((g) => ({
    inicio: g[0].fecha,
    fin: g[g.length - 1].fecha,
    dias: entre(g[0].fecha, g[g.length - 1].fecha) + 1,
    maxFlujo: g.reduce<Flujo>((m, d) => (ORDEN_FLUJO[d.flujo!] > ORDEN_FLUJO[m] ? d.flujo! : m), 'leve'),
  }));
}

// Sangrados fuera del periodo (para el informe)
export function sangradosIntermedios(dias: Dia[], ps: Periodo[]): string[] {
  return dias
    .filter((d) => d.flujo && d.flujo !== 'manchado')
    .filter((d) => !ps.some((p) => d.fecha >= p.inicio && d.fecha <= p.fin))
    .map((d) => d.fecha)
    .sort();
}

type Medida = { fecha: string; valor: number };

// Regla de "3 sobre 6": tres temperaturas seguidas por encima de las seis anteriores, la tercera
// al menos `margen` grados más alta. La ovulación es el día antes de la primera temperatura alta.
export function cambioTermico(medidas: Medida[], margen = 0.2): string | undefined {
  const m = [...medidas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (let j = 6; j + 2 < m.length; j++) {
    const previas = m.slice(j - 6, j);
    // Las seis previas deben ser recientes (sin un hueco grande sin medir)
    if (entre(previas[0].fecha, m[j].fecha) > 12) continue;
    if (entre(m[j].fecha, m[j + 2].fecha) > 4) continue;
    const linea = Math.max(...previas.map((p) => p.valor));
    if (m[j].valor > linea && m[j + 1].valor > linea && m[j + 2].valor >= linea + margen - 1e-9) return sumar(m[j].fecha, -1);
  }
  return undefined;
}

function ovulacionDe(dias: Dia[], inicio: string, fin: string): Pick<Ciclo, 'ovulacion' | 'fuenteOvulacion'> {
  const delCiclo = dias.filter((d) => d.fecha >= sumar(inicio, 5) && d.fecha <= fin);
  const basal = delCiclo.filter((d) => d.temperatura != null).map((d) => ({ fecha: d.fecha, valor: d.temperatura! }));
  const muneca = delCiclo.filter((d) => d.tempMuneca != null).map((d) => ({ fecha: d.fecha, valor: d.tempMuneca! }));
  const porTemp = cambioTermico(basal) ?? cambioTermico(muneca, 0.15);
  const lh = delCiclo.find((d) => d.lh === 'pico') ?? delCiclo.find((d) => d.lh === 'positivo');
  const porLh = lh ? sumar(lh.fecha, 1) : undefined;
  if (porTemp && porLh && Math.abs(entre(porTemp, porLh)) <= 2) return { ovulacion: porTemp, fuenteOvulacion: 'temperatura+lh' };
  if (porTemp) return { ovulacion: porTemp, fuenteOvulacion: 'temperatura' };
  if (porLh) return { ovulacion: porLh, fuenteOvulacion: 'lh' };
  return {};
}

const variaMucho = (a: Ajustes) => a.condiciones.some((c) => c === 'sop' || c === 'perimenopausia' || c === 'posparto' || c === 'lactancia');

export function ciclos(dias: Dia[], ajustes: Ajustes, hoy: string): Ciclo[] {
  const ps = periodos(dias);
  const largoMax = variaMucho(ajustes) ? 120 : 60;
  return ps.map((p, i) => {
    const siguiente = ps[i + 1];
    const duracion = siguiente ? entre(p.inicio, siguiente.inicio) : undefined;
    const fin = siguiente ? sumar(siguiente.inicio, -1) : hoy;
    const ov = ovulacionDe(dias, p.inicio, fin);
    const lutea = duracion && ov.ovulacion ? entre(ov.ovulacion, siguiente!.inicio) : undefined;
    return {
      inicio: p.inicio,
      duracion,
      periodo: p.dias,
      ...ov,
      lutea: lutea && lutea >= 7 && lutea <= 19 ? lutea : undefined,
      excluido: duracion == null ? undefined : duracion < 18 ? 'corto' : duracion > largoMax ? 'largo' : undefined,
    };
  });
}

// Promedio que pesa más lo reciente, mezclado con lo que ella dijo al empezar (o 28) mientras hay pocos datos
function estimar(valores: number[], previo: number, sdPrevia: number, pesoPrevio = 2) {
  const recientes = valores.slice(-12);
  const pesos = recientes.map((_, i) => Math.pow(0.85, recientes.length - 1 - i));
  const sumaPesos = pesos.reduce((a, b) => a + b, 0);
  // Lo que ella dijo al empezar pesa menos con cada ciclo registrado y deja de contar al quinto
  pesoPrevio = Math.max(0, pesoPrevio * (1 - recientes.length / 5));
  const media = (previo * pesoPrevio + recientes.reduce((a, v, i) => a + v * pesos[i], 0)) / (pesoPrevio + sumaPesos);
  const varianza = (pesoPrevio * sdPrevia ** 2 + recientes.reduce((a, v, i) => a + pesos[i] * (v - media) ** 2, 0)) / (pesoPrevio + sumaPesos);
  return { media, sd: Math.sqrt(varianza) };
}

export type Prediccion = {
  hoy: string;
  ciclos: Ciclo[];
  actual?: { inicio: string; dia: number; ovulacion?: string; fuenteOvulacion?: Ciclo['fuenteOvulacion'] };
  enPeriodo: boolean;
  proximo?: { probable: string; desde: string; hasta: string };
  ovulacion?: { probable: string; desde: string; hasta: string; confirmada: boolean };
  fertil?: { desde: string; hasta: string; masProbable: [string, string] };
  duracionMedia: number;
  desviacion: number;
  periodoMedio: number;
  luteaMedia: number;
  nCiclos: number;
  regularidad: 'aprendiendo' | 'regular' | 'irregular';
  confianza: 'alta' | 'media' | 'baja';
  retraso: number; // días pasados del rango esperado
  sinVentana: boolean; // con anticonceptivo hormonal no se muestra ventana fértil
  notas: string[];
  tramos: Tramo[];
};

const SD_MINIMA: Partial<Record<Ajustes['condiciones'][number], number>> = { sop: 6, perimenopausia: 7, posparto: 8, lactancia: 8 };

export function predecir(dias: Dia[], ajustes: Ajustes, hoy: string): Prediccion {
  const cs = ciclos(dias, ajustes, hoy).filter((c) => c.inicio <= hoy);
  const completos = cs.filter((c) => c.duracion != null && !c.excluido);
  const hormonal = ES_HORMONAL(ajustes.anticonceptivo);
  const notas: string[] = [];

  // Después de un parto solo cuentan los ciclos que vinieron después
  const desdeParto = ajustes.partoFecha && ajustes.condiciones.includes('posparto') ? completos.filter((c) => c.inicio > ajustes.partoFecha!) : completos;

  const largo = estimar(desdeParto.map((c) => c.duracion!), ajustes.cicloTipico, 3.5);
  const sdMin = Math.max(1.2, ...ajustes.condiciones.map((c) => SD_MINIMA[c] ?? 0));
  const sd = Math.max(largo.sd, sdMin);
  const duracionMedia = Math.round(largo.media);
  const periodoMedio = Math.round(estimar(cs.map((c) => c.periodo), ajustes.periodoTipico, 1).media);
  const luteas = cs.map((c) => c.lutea).filter((l): l is number => l != null);
  const luteaMedia = Math.round(Math.min(17, Math.max(10, estimar(luteas, 14, 1.5, 1).media)));

  const longitudes = desdeParto.map((c) => c.duracion!);
  const rango = longitudes.length ? Math.max(...longitudes) - Math.min(...longitudes) : 0;
  const regularidad = longitudes.length < 3 ? 'aprendiendo' : largo.sd > 4.5 || rango > 9 || sdMin >= 6 ? 'irregular' : 'regular';
  let confianza: Prediccion['confianza'] = longitudes.length >= 6 && sd <= 2.5 ? 'alta' : longitudes.length >= 3 && sd <= 5 ? 'media' : 'baja';
  if (ajustes.condiciones.some((c) => c === 'posparto' || c === 'lactancia')) confianza = 'baja';

  if (ajustes.condiciones.includes('sop')) notas.push('Con SOP los ciclos pueden variar mucho: el rango de fechas es más amplio a propósito.');
  if (ajustes.condiciones.includes('perimenopausia')) notas.push('En la perimenopausia los ciclos se acortan, se alargan o se saltan; la predicción es solo una guía.');
  if (ajustes.condiciones.some((c) => c === 'posparto' || c === 'lactancia')) notas.push('Después de un parto o durante la lactancia el primer periodo puede tardar meses y los primeros ciclos son irregulares.');
  if (longitudes.length < 3 && !hormonal) notas.push('Con tres ciclos registrados la predicción empieza a ser tuya; mientras tanto usa lo que contaste al empezar.');
  const excluidos = cs.filter((c) => c.excluido);
  if (excluidos.length) notas.push(`${excluidos.length === 1 ? 'Un ciclo quedó' : `${excluidos.length} ciclos quedaron`} por fuera del promedio por ser muy ${excluidos.every((c) => c.excluido === 'corto') ? 'cortos' : 'largos o con días sin registrar'}.`);

  const ultimo = cs[cs.length - 1];
  const actual = ultimo ? { inicio: ultimo.inicio, dia: entre(ultimo.inicio, hoy) + 1, ovulacion: ultimo.ovulacion, fuenteOvulacion: ultimo.fuenteOvulacion } : undefined;
  const ps = periodos(dias);
  const ultimoPeriodo = ps.filter((p) => p.inicio <= hoy).pop();
  // Hoy está con el periodo si lo registró, o si lo registró ayer y todavía no pasa lo que suele durar
  const hoyConFlujo = dias.some((d) => d.fecha === hoy && d.flujo && d.flujo !== 'manchado');
  const enCurso = !!ultimoPeriodo && entre(ultimoPeriodo.fin, hoy) <= 1 && entre(ultimoPeriodo.inicio, hoy) < periodoMedio;
  const enPeriodo = hoyConFlujo || enCurso;

  const base: Omit<Prediccion, 'proximo' | 'ovulacion' | 'fertil' | 'retraso' | 'tramos'> = {
    hoy, ciclos: cs, actual, enPeriodo, duracionMedia, desviacion: Math.round(sd * 10) / 10, periodoMedio, luteaMedia,
    nCiclos: longitudes.length, regularidad, confianza, sinVentana: hormonal, notas,
  };

  // Pastilla, anillo o parche: el sangrado llega en los días de descanso del paquete
  if (hormonal && CON_PAQUETE(ajustes.anticonceptivo) && ajustes.paquete) {
    notas.unshift('Con tu método, el sangrado es por retiro y llega en los días de descanso; no hay ovulación que predecir.');
    return { ...base, confianza: 'alta', regularidad: 'regular', ...prediccionPaquete(ajustes.paquete, hoy) };
  }
  if (hormonal) notas.unshift('Con anticonceptivo hormonal la ovulación suele estar suprimida: no se muestra ventana fértil y los sangrados pueden ser irregulares o no llegar.');

  if (!actual) return { ...base, retraso: 0, tramos: [] };

  // Si en este ciclo ya se confirmó la ovulación, el próximo periodo sale de la fase lútea, que varía poco
  let probable: number;
  let margen: number;
  if (actual.ovulacion && !hormonal) {
    probable = num(actual.ovulacion) + luteaMedia;
    margen = 2;
  } else {
    probable = num(actual.inicio) + duracionMedia;
    margen = Math.max(1, Math.ceil(1.28 * sd));
  }
  const proximo = { probable: fecha(probable), desde: fecha(probable - margen), hasta: fecha(probable + margen) };
  const retraso = Math.max(0, num(hoy) - (probable + margen));
  if (retraso > 0) notas.unshift(`El periodo va ${retraso === 1 ? 'un día más tarde' : `${retraso} días más tarde`} de lo esperado. El estrés, un viaje o estar enferma lo pueden mover${ajustes.modo === 'buscar' ? '; si buscan embarazo, es buen momento para una prueba' : ''}.`);

  let ovulacion: Prediccion['ovulacion'];
  let fertil: Prediccion['fertil'];
  if (!hormonal) {
    const ov = actual.ovulacion ? num(actual.ovulacion) : probable - luteaMedia;
    const mOv = actual.ovulacion ? 0 : margen;
    ovulacion = { probable: fecha(ov), desde: fecha(Math.max(num(actual.inicio) + 6, ov - mOv)), hasta: fecha(ov + mOv), confirmada: !!actual.ovulacion };
    fertil = { desde: fecha(Math.max(num(actual.inicio) + 4, ov - mOv - 5)), hasta: fecha(ov + mOv + 1), masProbable: [fecha(ov - 2), fecha(ov)] };
  }

  return { ...base, proximo, ovulacion, fertil, retraso, tramos: tramos(actual.inicio, num(actual.inicio) + Math.max(entre(actual.inicio, hoy) + 1, probable - num(actual.inicio)), ultimoPeriodo, periodoMedio, duracionMedia, luteaMedia, ovulacion?.probable, hormonal, hoy) };
}

function prediccionPaquete(p: NonNullable<Ajustes['paquete']>, hoy: string): Pick<Prediccion, 'proximo' | 'retraso' | 'tramos' | 'enPeriodo'> {
  const largo = p.activos + p.descanso;
  if (p.descanso === 0) return { retraso: 0, tramos: [{ fase: 'hormonal', desde: hoy, hasta: sumar(hoy, 60), estimado: true }], enPeriodo: false };
  const vuelta = Math.floor(entre(p.inicio, hoy) / largo);
  const inicioPaquete = num(p.inicio) + Math.max(0, vuelta) * largo;
  const ts: Tramo[] = [];
  for (let k = 0; k < 3; k++) {
    const i = inicioPaquete + k * largo;
    ts.push({ fase: 'hormonal', desde: fecha(i), hasta: fecha(i + p.activos - 1), estimado: true });
    ts.push({ fase: 'menstrual', desde: fecha(i + p.activos), hasta: fecha(i + largo - 1), estimado: true });
  }
  const descanso = inicioPaquete + p.activos;
  const siguiente = num(hoy) > descanso + p.descanso - 1 ? descanso + largo : descanso;
  const enDescanso = num(hoy) >= descanso && num(hoy) <= descanso + p.descanso - 1;
  return {
    proximo: { probable: fecha(siguiente + 1), desde: fecha(siguiente), hasta: fecha(siguiente + Math.min(3, p.descanso - 1)) },
    retraso: 0,
    tramos: ts,
    enPeriodo: enDescanso,
  };
}

// Las fases del ciclo actual y de los dos siguientes, para la vista de la pareja y el calendario
function tramos(inicio: string, finActual: number, periodo: { inicio: string; fin: string } | undefined, periodoMedio: number, duracion: number,
  lutea: number, ovulacion: string | undefined, hormonal: boolean, hoy: string): Tramo[] {
  const ts: Tramo[] = [];
  const agregar = (fase: Fase, a: number, b: number, estimado: boolean) => { if (b >= a) ts.push({ fase, desde: fecha(a), hasta: fecha(b), estimado }); };
  const uno = (i: number, fin: number, ov: number | undefined, real: boolean) => {
    // El periodo del ciclo actual es el registrado; si sigue en curso, se estima hasta lo que suele durar
    const registrado = real && periodo && periodo.inicio === fecha(i) ? periodo : undefined;
    const sigue = !!registrado && num(registrado.fin) >= num(hoy) - 1;
    const finPeriodo = registrado ? (sigue ? Math.max(num(registrado.fin), i + periodoMedio - 1) : num(registrado.fin)) : i + periodoMedio - 1;
    agregar('menstrual', i, Math.min(finPeriodo, fin), !registrado || sigue);
    if (hormonal) { agregar('hormonal', finPeriodo + 1, fin, true); return; }
    const o = ov ?? fin + 1 - lutea;
    const premen = Math.max(o + 2, fin - 4);
    agregar('folicular', finPeriodo + 1, o - 2, true);
    agregar('ovulatoria', Math.max(finPeriodo + 1, o - 1), o + 1, !(real && ovulacion && ov != null));
    agregar('lutea', o + 2, premen - 1, true);
    agregar('premenstrual', premen, fin, true);
  };
  const i0 = num(inicio);
  uno(i0, finActual - 1, ovulacion ? num(ovulacion) : undefined, true);
  let i = finActual;
  for (let k = 0; k < 2; k++) { uno(i, i + duracion - 1, undefined, false); i += duracion; }
  return ts;
}

// Cuándo toca la próxima inyección. La mensual se pone cada 30 días (con unos 3 de margen) desde la primera,
// que se aplica el primer día del periodo; la trimestral, cada 12 semanas y media más o menos (90 días)
export function proximaInyeccion(ajustes: Ajustes, hoy: string): { fecha: string; dias: number } | null {
  if (ajustes.anticonceptivo !== 'inyeccion' || !ajustes.inyeccion?.ultima) return null;
  const fechaSiguiente = sumar(ajustes.inyeccion.ultima, ajustes.inyeccion.cada);
  return { fecha: fechaSiguiente, dias: entre(hoy, fechaSiguiente) };
}

export const faseEn = (ts: Tramo[], dia: string): Tramo | undefined => ts.find((t) => dia >= t.desde && dia <= t.hasta);

// Qué suele pasarle en cada fase: síntomas y ánimos que aparecen en al menos 40 % de los días registrados
export type Patron = { fase: Fase; dias: number; frecuentes: { id: string; tipo: 'sintoma' | 'animo'; frecuencia: number }[]; dolorMedio: number };

export function patrones(dias: Dia[], ajustes: Ajustes, hoy: string): Patron[] {
  const cs = ciclos(dias, ajustes, hoy).filter((c) => c.duracion && !c.excluido);
  const ps = periodos(dias);
  const porFase = new Map<Fase, Dia[]>();
  for (const c of cs) {
    const ini = num(c.inicio);
    const fin = ini + c.duracion! - 1;
    const p = ps.find((x) => x.inicio === c.inicio);
    const ov = c.ovulacion ? num(c.ovulacion) : fin + 1 - (c.lutea ?? 14);
    for (const d of dias) {
      const n = num(d.fecha);
      if (n < ini || n > fin) continue;
      if (!d.sintomas?.length && !d.animo?.length && d.dolor == null) continue;
      const fase: Fase = p && n <= num(p.fin) ? 'menstrual' : n >= fin - 4 ? 'premenstrual' : Math.abs(n - ov) <= 1 ? 'ovulatoria' : n < ov ? 'folicular' : 'lutea';
      porFase.set(fase, [...(porFase.get(fase) ?? []), d]);
    }
  }
  const salida: Patron[] = [];
  for (const [fase, ds] of porFase) {
    if (ds.length < 3) continue;
    const cuenta = new Map<string, { tipo: 'sintoma' | 'animo'; n: number }>();
    for (const d of ds) {
      for (const s of d.sintomas ?? []) cuenta.set(`s:${s}`, { tipo: 'sintoma', n: (cuenta.get(`s:${s}`)?.n ?? 0) + 1 });
      for (const a of d.animo ?? []) cuenta.set(`a:${a}`, { tipo: 'animo', n: (cuenta.get(`a:${a}`)?.n ?? 0) + 1 });
    }
    const frecuentes = [...cuenta.entries()]
      .map(([k, v]) => ({ id: k.slice(2), tipo: v.tipo, frecuencia: v.n / ds.length }))
      .filter((f) => f.frecuencia >= 0.4)
      .sort((a, b) => b.frecuencia - a.frecuencia);
    const conDolor = ds.filter((d) => d.dolor != null);
    salida.push({ fase, dias: ds.length, frecuentes, dolorMedio: conDolor.length ? conDolor.reduce((a, d) => a + d.dolor!, 0) / conDolor.length : 0 });
  }
  return salida;
}
