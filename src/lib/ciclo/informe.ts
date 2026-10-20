// Informe para llevar a la consulta: historial de ciclos, síntomas y patrones, en PDF.
import type { Ajustes, Dia } from './tipos';
import { patrones, periodos, sangradosIntermedios, type Prediccion } from './prediccion';
import { ANIMOS, ANTICONCEPTIVOS, CONDICIONES, DOLORES, NOMBRE_FASE, SINTOMAS, etiqueta } from './catalogo';
import { ANCHO_PAGINA, ALTO_PAGINA, DocumentoPdf, partirTexto, type Color } from './pdf';

const VERDE: Color = [31, 107, 74];
const SALVIA: Color = [69, 107, 88];
const MENTA: Color = [207, 230, 215];
const CORAL: Color = [169, 78, 53];
const MARGEN = 50;
const ANCHO = ANCHO_PAGINA - MARGEN * 2;

const fechaLarga = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

export type OpcionesInforme = { nombre: string; desde: string; hasta: string; incluirNotas: boolean };

export function generarInforme(dias: Dia[], ajustes: Ajustes, p: Prediccion, o: OpcionesInforme): Uint8Array {
  const doc = new DocumentoPdf();
  let y = MARGEN;
  const enRango = dias.filter((d) => d.fecha >= o.desde && d.fecha <= o.hasta).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const cs = p.ciclos.filter((c) => c.inicio >= o.desde && c.inicio <= o.hasta);
  const ps = periodos(dias).filter((x) => x.inicio >= o.desde && x.inicio <= o.hasta);

  const espacio = (alto: number) => { if (y + alto > ALTO_PAGINA - MARGEN - 20) { doc.nuevaPagina(); y = MARGEN; } };
  const titulo = (t: string) => { espacio(40); y += 14; doc.texto(MARGEN, y, t, { tam: 13, negrita: true, color: VERDE }); y += 6; doc.linea(MARGEN, y, MARGEN + ANCHO, y, MENTA); y += 14; };
  const parrafo = (t: string, tam = 10, color?: Color) => {
    for (const l of partirTexto(t, ANCHO, tam)) { espacio(tam + 4); doc.texto(MARGEN, y, l, { tam, color }); y += tam + 4; }
  };
  const fila = (celdas: string[], anchos: number[], negrita = false) => {
    espacio(16);
    let x = MARGEN;
    celdas.forEach((c, i) => { doc.texto(x, y, c, { tam: 9, negrita }); x += anchos[i]; });
    y += 6; doc.linea(MARGEN, y, MARGEN + ANCHO, y, MENTA, 0.5); y += 10;
  };

  // Encabezado
  doc.texto(MARGEN, y + 6, 'Informe del ciclo menstrual', { tam: 20, negrita: true, color: VERDE });
  y += 28;
  doc.texto(MARGEN, y, `${o.nombre ? `${o.nombre} · ` : ''}Del ${fechaLarga(o.desde)} al ${fechaLarga(o.hasta)} · Generado el ${fechaLarga(p.hoy)}`, { tam: 10, color: SALVIA });
  y += 18;

  titulo('Resumen');
  const longitudes = cs.filter((c) => c.duracion && !c.excluido).map((c) => c.duracion!);
  // La variación real de sus ciclos (la de la predicción lleva además un margen de seguridad)
  const media = longitudes.reduce((a, x) => a + x, 0) / (longitudes.length || 1);
  const variacion = Math.sqrt(longitudes.reduce((a, x) => a + (x - media) ** 2, 0) / (longitudes.length || 1));
  const resumen: [string, string][] = [
    ['Ciclos completos registrados', String(longitudes.length)],
    ['Duración del ciclo', longitudes.length ? `${Math.round(media)} días en promedio (de ${Math.min(...longitudes)} a ${Math.max(...longitudes)}; desviación ${variacion.toFixed(1).replace('.', ',')} días)` : 'Sin ciclos completos en el periodo'],
    ['Duración del sangrado', ps.length ? `${Math.round(ps.reduce((a, x) => a + x.dias, 0) / ps.length)} días en promedio` : '—'],
    ['Regularidad', { aprendiendo: 'Pocos datos todavía', regular: 'Regular', irregular: 'Irregular (varía más de 7 a 9 días)' }[p.regularidad]],
    ['Fase lútea', cs.some((c) => c.lutea) ? `${p.luteaMedia} días en promedio (con ovulación detectada)` : 'Sin ovulación detectada'],
    ['Condiciones', ajustes.condiciones.length ? ajustes.condiciones.map((c) => etiqueta(CONDICIONES, c)).join(', ') : 'Ninguna registrada'],
    ['Anticonceptivo', etiqueta(ANTICONCEPTIVOS, ajustes.anticonceptivo) + (ajustes.anticonceptivo === 'inyeccion' && ajustes.inyeccion ? ` ${ajustes.inyeccion.cada === 30 ? 'mensual' : 'trimestral'}, última el ${fechaLarga(ajustes.inyeccion.ultima)}` : '')],
    ['Último periodo', p.actual ? fechaLarga(p.actual.inicio) : '—'],
    ['Próximo periodo estimado', p.proximo ? `${fechaLarga(p.proximo.desde)} a ${fechaLarga(p.proximo.hasta)}` : '—'],
  ];
  for (const [k, v] of resumen) {
    const lineas = partirTexto(v, ANCHO - 170, 10);
    espacio(lineas.length * 14);
    doc.texto(MARGEN, y, k, { tam: 10, negrita: true });
    lineas.forEach((l, i) => doc.texto(MARGEN + 170, y + i * 14, l, { tam: 10 }));
    y += lineas.length * 14 + 2;
  }

  // Gráfica de barras con la duración de cada ciclo
  if (longitudes.length >= 2) {
    titulo('Duración de cada ciclo');
    const alto = 110;
    espacio(alto + 30);
    const maximo = Math.max(40, ...longitudes);
    const barra = Math.min(28, (ANCHO - 30) / longitudes.length - 6);
    const base = y + alto;
    for (const ref of [21, 28, 35]) {
      const yr = base - (ref / maximo) * alto;
      doc.linea(MARGEN + 24, yr, MARGEN + ANCHO, yr, MENTA, 0.5);
      doc.texto(MARGEN, yr + 3, String(ref), { tam: 8, color: SALVIA });
    }
    cs.filter((c) => c.duracion && !c.excluido).forEach((c, i) => {
      const h = (c.duracion! / maximo) * alto;
      const x = MARGEN + 30 + i * (barra + 6);
      doc.rect(x, base - h, barra, h, c.duracion! < 21 || c.duracion! > 35 ? CORAL : VERDE);
      doc.texto(x + 2, base - h - 4, String(c.duracion), { tam: 7, color: SALVIA });
    });
    y = base + 14;
    doc.texto(MARGEN, y, 'Líneas de referencia en 21, 28 y 35 días. En coral, los ciclos fuera de 21 a 35 días.', { tam: 8, color: SALVIA });
    y += 10;
  }

  titulo('Ciclos');
  const anchos = [95, 70, 75, 85, 100, 87];
  fila(['Inicio', 'Duración', 'Sangrado', 'Intensidad', 'Ovulación', 'Fase lútea'], anchos, true);
  for (const c of cs) {
    const per = ps.find((x) => x.inicio === c.inicio);
    fila([
      fechaLarga(c.inicio),
      c.duracion ? `${c.duracion} días${c.excluido ? '*' : ''}` : 'en curso',
      `${c.periodo} días`,
      per ? { manchado: 'Manchado', leve: 'Leve', medio: 'Media', abundante: 'Abundante' }[per.maxFlujo] : '—',
      c.ovulacion ? `${fechaLarga(c.ovulacion).replace(/ de \d{4}$/, '')} (${c.fuenteOvulacion === 'lh' ? 'LH' : c.fuenteOvulacion === 'temperatura' ? 'temp.' : 'temp. + LH'})` : '—',
      c.lutea ? `${c.lutea} días` : '—',
    ], anchos);
  }
  if (cs.some((c) => c.excluido)) parrafo('* Fuera del promedio: muy corto o muy largo (puede ser un periodo sin registrar).', 8, SALVIA);

  const intermedios = sangradosIntermedios(enRango, ps);
  if (intermedios.length) {
    titulo('Sangrado fuera del periodo');
    parrafo(intermedios.map(fechaLarga).join(', '));
  }

  // Síntomas: cuántos días y en qué fase aparecen
  const conSintomas = enRango.filter((d) => d.sintomas?.length);
  const conDolor = enRango.filter((d) => d.dolor != null);
  if (conSintomas.length || conDolor.length) {
    titulo('Síntomas');
    const cuenta = new Map<string, number>();
    for (const d of conSintomas) for (const s of d.sintomas!) cuenta.set(s, (cuenta.get(s) ?? 0) + 1);
    const orden = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
    if (orden.length) parrafo(orden.map(([s, k]) => `${etiqueta(SINTOMAS, s)}: ${k} ${k === 1 ? 'día' : 'días'}`).join(' · '));
    if (conDolor.length) {
      const fuertes = conDolor.filter((d) => d.dolor === 3).length;
      const medio = conDolor.reduce((a, d) => a + d.dolor!, 0) / conDolor.length;
      parrafo(`Dolor registrado en ${conDolor.length} días. Promedio: ${DOLORES[Math.round(medio)].toLowerCase()}. Dolor fuerte: ${fuertes} ${fuertes === 1 ? 'día' : 'días'}.`);
    }
  }

  const pts = patrones(enRango, ajustes, p.hoy);
  if (pts.length) {
    titulo('Patrones por fase');
    parrafo('Síntomas y estados de ánimo que aparecen en al menos 40 % de los días registrados de cada fase.', 8, SALVIA);
    for (const pt of pts) {
      const lista = pt.frecuentes.map((f) => `${etiqueta(f.tipo === 'sintoma' ? SINTOMAS : ANIMOS, f.id)} (${Math.round(f.frecuencia * 100)} %)`).join(', ');
      parrafo(`${NOMBRE_FASE[pt.fase]} (${pt.dias} días): ${lista || 'nada frecuente'}${pt.dolorMedio ? `. Dolor promedio: ${DOLORES[Math.round(pt.dolorMedio)].toLowerCase()}` : ''}.`);
    }
  }

  const temps = enRango.filter((d) => d.temperatura != null);
  const fc = enRango.filter((d) => d.fcReposo != null);
  const lh = enRango.filter((d) => d.lh);
  const emb = enRango.filter((d) => d.embarazo);
  if (temps.length || fc.length || lh.length || emb.length) {
    titulo('Mediciones');
    if (temps.length) parrafo(`Temperatura basal: ${temps.length} mediciones, de ${Math.min(...temps.map((d) => d.temperatura!)).toFixed(2)} a ${Math.max(...temps.map((d) => d.temperatura!)).toFixed(2)} °C.`);
    if (fc.length) parrafo(`Frecuencia cardíaca en reposo: ${fc.length} días, promedio ${Math.round(fc.reduce((a, d) => a + d.fcReposo!, 0) / fc.length)} lpm.`);
    if (lh.length) parrafo(`Pruebas de ovulación: ${lh.length} (${lh.filter((d) => d.lh !== 'negativo').length} positivas).`);
    if (emb.length) parrafo(`Pruebas de embarazo: ${emb.map((d) => `${fechaLarga(d.fecha)} ${d.embarazo}`).join(', ')}.`);
  }

  if (o.incluirNotas) {
    const notas = enRango.filter((d) => d.nota?.trim());
    if (notas.length) {
      titulo('Notas');
      for (const d of notas) parrafo(`${fechaLarga(d.fecha)}: ${d.nota!.trim()}`);
    }
  }

  y += 8;
  parrafo(`Datos registrados por la usuaria en la app You and me. Las fechas de ovulación salen de la temperatura basal (regla de 3 sobre 6) o de pruebas de LH, y las predicciones son estimaciones: no es un diagnóstico ni un método anticonceptivo. ${p.notas.length ? 'Notas de la predicción: ' + p.notas.join(' ') : ''}`, 8, SALVIA);

  return doc.guardar();
}

export const nombreArchivoInforme = (hoy: string) => `informe-ciclo-${hoy}.pdf`;
