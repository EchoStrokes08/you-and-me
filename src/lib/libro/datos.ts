// Lo que va en el libro: trae del rango los recuerdos (con fotos, notas y canciones), las mejores
// preguntas del día que respondieron los dos, las cartas ya abiertas y los lugares, y arma el plan
// de páginas. Solo lee; cada uno arma su libro con lo que puede ver (las cartas sin abrir no salen).
import { supabase } from '../supabase';
import { hoyStr } from '../utils';

export type Rango = { desde: string | null; hasta: string | null; etiqueta: string };
export type Opciones = { preguntas: boolean; cartas: boolean };

export type RecuerdoLibro = {
  id: string; titulo: string; fecha: string; lugar: string | null; descripcion: string | null; calificacion: number;
  fotos: string[]; notas: { quien: string; texto: string }[]; canciones: { titulo: string; artista: string | null }[];
};
export type ParPregunta = { fecha: string; pregunta: string; respuestas: { quien: string; texto: string }[]; corazones: number };
export type CartaLibro = { fecha: string; titulo: string; emoji: string | null; de: string; para: string; contenido: string };
export type Cifra = { n: number; txt: string };

export type DatosLibro = {
  nombres: string; el: string; ella: string;
  rango: { desde: string; hasta: string; etiqueta: string };
  recuerdos: RecuerdoLibro[]; preguntas: ParPregunta[]; cartas: CartaLibro[];
  canciones: { titulo: string; artista: string | null }[];
  lugares: { nombre: string; veces: number }[];
  cifras: Cifra[];
};

export type Pagina =
  | { tipo: 'portada' }
  | { tipo: 'cifras' }
  | { tipo: 'mes'; mes: string; recuerdos: number }
  | { tipo: 'recuerdo'; r: RecuerdoLibro }
  | { tipo: 'collage'; r: RecuerdoLibro; fotos: string[] }
  | { tipo: 'preguntas'; items: ParPregunta[]; titulo: boolean }
  | { tipo: 'seccion'; titulo: string; subtitulo: string }
  | { tipo: 'carta'; c: CartaLibro }
  | { tipo: 'canciones'; items: { titulo: string; artista: string | null }[] }
  | { tipo: 'lugares'; items: { nombre: string; veces: number }[] }
  | { tipo: 'final' };

export const MAX_RECUERDOS = 80;
export const PREGUNTAS_POR_MES = 3;
const CANCIONES_POR_PAGINA = 12;
const LUGARES_POR_PAGINA = 16;

const trozos = <T,>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const mesDe = (fecha: string) => fecha.slice(0, 7);

/** El orden del libro: portada, cifras, mes por mes (recuerdos y sus mejores preguntas), cartas, música, lugares y cierre */
export function planDelLibro(d: DatosLibro, op: Opciones): Pagina[] {
  const paginas: Pagina[] = [{ tipo: 'portada' }];
  if (d.cifras.length) paginas.push({ tipo: 'cifras' });

  const meses = new Set([...d.recuerdos.map((r) => mesDe(r.fecha)), ...(op.preguntas ? d.preguntas.map((p) => mesDe(p.fecha)) : [])]);
  for (const mes of [...meses].sort()) {
    const rs = d.recuerdos.filter((r) => mesDe(r.fecha) === mes);
    paginas.push({ tipo: 'mes', mes, recuerdos: rs.length });
    for (const r of rs) {
      paginas.push({ tipo: 'recuerdo', r });
      // Las demás fotos van juntas en una página, de a cuatro (las mejores primero)
      const resto = r.fotos.slice(1, 9);
      if (resto.length >= 2) for (const grupo of trozos(resto, 4)) if (grupo.length >= 2) paginas.push({ tipo: 'collage', r, fotos: grupo });
    }
    if (op.preguntas) {
      const del = mejoresPreguntas(d.preguntas.filter((p) => mesDe(p.fecha) === mes), PREGUNTAS_POR_MES);
      if (del.length) paginas.push({ tipo: 'preguntas', items: del, titulo: true });
    }
  }

  if (op.cartas && d.cartas.length) {
    paginas.push({ tipo: 'seccion', titulo: 'Lo que nos escribimos', subtitulo: d.cartas.length === 1 ? 'Una carta' : `${d.cartas.length} cartas` });
    for (const c of d.cartas) paginas.push({ tipo: 'carta', c });
  }
  for (const items of trozos(d.canciones, CANCIONES_POR_PAGINA)) paginas.push({ tipo: 'canciones', items });
  for (const items of trozos(d.lugares, LUGARES_POR_PAGINA)) paginas.push({ tipo: 'lugares', items });
  paginas.push({ tipo: 'final' });
  return paginas;
}

/** Las que más dicen: primero las que recibieron corazón, después las respuestas más largas */
export function mejoresPreguntas(ps: ParPregunta[], max: number): ParPregunta[] {
  const largo = (p: ParPregunta) => p.respuestas.reduce((a, r) => a + r.texto.length, 0);
  return [...ps].sort((a, b) => b.corazones - a.corazones || largo(b) - largo(a)).slice(0, max).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Con muchos recuerdos se quedan los mejor calificados y con más fotos, y vuelven a orden de fecha */
export function elegirRecuerdos<T extends { fecha: string; calificacion: number; fotos: unknown[] }>(rs: T[], max = MAX_RECUERDOS): T[] {
  if (rs.length <= max) return rs;
  return [...rs].sort((a, b) => b.calificacion - a.calificacion || b.fotos.length - a.fotos.length).slice(0, max).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Las listas largas de ids se piden por partes para no pasarse del largo de la URL
async function porPartes<T>(ids: string[], pedir: (parte: string[]) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (const parte of trozos(ids, 100)) out.push(...((await pedir(parte)).data ?? []));
  return out;
}

const dentro = (f: string, r: Rango) => (!r.desde || f >= r.desde) && (!r.hasta || f <= r.hasta);

export async function traerDatos(rango: Rango, yo: string): Promise<DatosLibro | null> {
  const [{ data: cfg }, { data: perfiles }] = await Promise.all([
    supabase.from('configuracion').select('nombre_el, nombre_ella, fecha_inicio').eq('id', 1).single(),
    supabase.from('perfiles').select('id, rol'),
  ]);
  const el = cfg?.nombre_el ?? 'Él', ella = cfg?.nombre_ella ?? 'Ella';
  const nombre = (id: string | null) => (perfiles?.find((p) => p.id === id)?.rol === 'admin' ? el : ella);

  // Recuerdos con sus fotos (sin videos: en papel no se mueven), notas y canciones
  let q = supabase.from('recuerdos').select('id, titulo, fecha, lugar_texto, descripcion, calificacion').order('fecha');
  if (rango.desde) q = q.gte('fecha', rango.desde);
  if (rango.hasta) q = q.lte('fecha', rango.hasta);
  const { data: rs } = await q;
  const ids = (rs ?? []).map((r) => r.id);
  const [fotos, notas, cancionesR] = await Promise.all([
    porPartes(ids, (p) => supabase.from('fotos_recuerdo').select('recuerdo_id, ruta, orden, tipo, favorita').in('recuerdo_id', p)),
    porPartes(ids, (p) => supabase.from('notas_recuerdo').select('recuerdo_id, usuario_id, texto, created_at').in('recuerdo_id', p).order('created_at')),
    porPartes(ids, (p) => supabase.from('canciones').select('recuerdo_id, titulo, artista').in('recuerdo_id', p)),
  ]);
  const recuerdos = elegirRecuerdos((rs ?? []).map((r) => ({
    id: r.id, titulo: r.titulo, fecha: r.fecha, lugar: r.lugar_texto, descripcion: r.descripcion, calificacion: r.calificacion,
    fotos: fotos.filter((f) => f.recuerdo_id === r.id && f.tipo !== 'video')
      .sort((a, b) => Number(b.favorita) - Number(a.favorita) || a.orden - b.orden).map((f) => f.ruta),
    notas: notas.filter((n) => n.recuerdo_id === r.id).map((n) => ({ quien: nombre(n.usuario_id), texto: n.texto })),
    canciones: cancionesR.filter((c) => c.recuerdo_id === r.id).map((c) => ({ titulo: c.titulo, artista: c.artista })),
  })));

  // Canciones del rango: las de los recuerdos y las que guardaron sueltas en esas fechas
  let qc = supabase.from('canciones').select('titulo, artista, created_at, recuerdo_id').is('recuerdo_id', null);
  if (rango.desde) qc = qc.gte('created_at', rango.desde);
  if (rango.hasta) qc = qc.lte('created_at', `${rango.hasta}T23:59:59`);
  const { data: sueltas } = await qc;
  const vistas = new Set<string>();
  const canciones = [...recuerdos.flatMap((r) => r.canciones), ...(sueltas ?? []).map((c) => ({ titulo: c.titulo, artista: c.artista }))]
    .filter((c) => { const k = `${c.titulo}|${c.artista ?? ''}`.toLowerCase(); if (vistas.has(k)) return false; vistas.add(k); return true; });

  // Preguntas del día que respondieron los dos (las del otro solo se ven si uno respondió)
  let qd = supabase.from('pregunta_del_dia').select('fecha, pregunta_id, preguntas(texto)').lte('fecha', hoyStr()).order('fecha');
  if (rango.desde) qd = qd.gte('fecha', rango.desde);
  if (rango.hasta) qd = qd.lte('fecha', rango.hasta);
  const { data: dias } = await qd;
  const pids = [...new Set((dias ?? []).map((d) => d.pregunta_id))];
  const respuestas = await porPartes(pids, (p) => supabase.from('respuestas').select('id, pregunta_id, usuario_id, texto').in('pregunta_id', p));
  const reacciones = await porPartes(respuestas.map((r) => r.id), (p) => supabase.from('reacciones_respuesta').select('respuesta_id, corazon').in('respuesta_id', p));
  const preguntas: ParPregunta[] = [];
  for (const d of dias ?? []) {
    const de = respuestas.filter((r) => r.pregunta_id === d.pregunta_id);
    if (de.length < 2 || !d.preguntas) continue;
    // Él primero, para que en todo el libro salgan en el mismo orden
    const orden = [...de].sort((a, b) => Number(nombre(a.usuario_id) !== el) - Number(nombre(b.usuario_id) !== el));
    preguntas.push({
      fecha: d.fecha, pregunta: d.preguntas.texto,
      respuestas: orden.map((r) => ({ quien: nombre(r.usuario_id), texto: r.texto })),
      corazones: reacciones.filter((x) => x.corazon && de.some((r) => r.id === x.respuesta_id)).length,
    });
  }

  // Cartas ya abiertas: las que escribí y las que me escribieron
  const [{ data: mias }, { data: recibidas }] = await Promise.all([
    supabase.from('cartas').select('titulo, emoji, de, para, contenido, created_at, abierta_en').not('abierta_en', 'is', null),
    supabase.rpc('cartas_recibidas'),
  ]);
  const cartas: CartaLibro[] = [
    ...(mias ?? []).map((c) => ({ ...c, de: nombre(c.de), para: nombre(c.para) })),
    ...(recibidas ?? []).filter((c) => c.abierta_en && c.contenido).map((c) => ({ ...c, contenido: c.contenido!, de: nombre(c.de), para: nombre(yo) })),
  ].map((c) => ({ fecha: c.created_at.slice(0, 10), titulo: c.titulo, emoji: c.emoji, de: c.de, para: c.para, contenido: c.contenido }))
    .filter((c) => dentro(c.fecha, rango) && c.contenido.trim())
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (!recuerdos.length && !preguntas.length) return null;

  // Los lugares donde estuvieron, del más visitado al menos
  const conteo = new Map<string, number>();
  for (const r of rs ?? []) if (r.lugar_texto?.trim()) conteo.set(r.lugar_texto.trim(), (conteo.get(r.lugar_texto.trim()) ?? 0) + 1);
  const lugares = [...conteo].map(([nombre, veces]) => ({ nombre, veces })).sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre));

  let qv = supabase.from('citas').select('id', { count: 'exact', head: true }).eq('estado', 'vivida');
  if (rango.desde) qv = qv.gte('fecha', rango.desde);
  if (rango.hasta) qv = qv.lte('fecha', rango.hasta);
  const { count: citas } = await qv;

  const fechas = [...recuerdos.map((r) => r.fecha), ...preguntas.map((p) => p.fecha)].sort();
  const desde = rango.desde ?? cfg?.fecha_inicio ?? fechas[0];
  const hasta = rango.hasta && rango.hasta < hoyStr() ? rango.hasta : hoyStr();
  const dias_ = Math.max(1, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) + 1);
  const nFotos = recuerdos.reduce((a, r) => a + r.fotos.length, 0);
  const cifras: Cifra[] = ([
    [dias_, rango.desde ? 'días en este libro' : 'días juntos'],
    [citas ?? 0, citas === 1 ? 'cita vivida' : 'citas vividas'],
    [recuerdos.length, recuerdos.length === 1 ? 'recuerdo' : 'recuerdos'],
    [nFotos, nFotos === 1 ? 'foto' : 'fotos'],
    [preguntas.length, preguntas.length === 1 ? 'pregunta respondida' : 'preguntas respondidas'],
    [lugares.length, lugares.length === 1 ? 'lugar' : 'lugares'],
    [canciones.length, canciones.length === 1 ? 'canción' : 'canciones'],
    [cartas.length, cartas.length === 1 ? 'carta' : 'cartas'],
  ] as [number, string][]).filter(([n]) => n > 0).slice(0, 6).map(([n, txt]) => ({ n, txt }));

  return { nombres: `${el} & ${ella}`, el, ella, rango: { desde, hasta, etiqueta: rango.etiqueta }, recuerdos, preguntas, cartas, canciones, lugares, cifras };
}
