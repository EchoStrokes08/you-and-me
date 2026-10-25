// Función de Vercel: el asistente de la app (Payakan). Prueba en orden, y si uno falla pasa al siguiente:
// Claude (ANTHROPIC_API_KEY, de pago), Groq (GROQ_API_KEY, gratis) y Gemini (GEMINI_API_KEY, gratis).
// Claude y Groq buscan en internet para lo que cambia con el tiempo; Gemini (el último recurso) no.
// Groq y Gemini aceptan varias claves separadas por comas: si una se queda sin cuota se usa la otra.
// Lee los datos de la pareja con la sesión de quien pregunta (las reglas de RLS siguen valiendo:
// no ve respuestas que aún no se pueden ver, ni regalos comprados, ni lo que el otro tiene en secreto).
// Las claves van en las variables de entorno de Vercel, nunca en el código.
import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const MODELO = 'claude-opus-5-5';
const TOPE_DIARIO = 30;
const HISTORIA = 20;

type Accion = { tipo: 'planear_cita' | 'agregar_plan' | 'agregar_peli' | 'escribir_carta' | 'regalar_cupon'; titulo: string; detalle?: string; texto?: string };

const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

// "jueves 15 de octubre de 2026" y las fechas del próximo fin de semana: sin esto los modelos
// calculan mal "este sábado" o "este fin de semana" al buscar eventos
export function fechasParaElSistema(hoy: string): { hoy: string; finde: string } {
  const dia = new Date(`${hoy}T12:00:00Z`);
  const largo = (d: Date) => d.toLocaleDateString('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const corto = (d: Date) => d.toLocaleDateString('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'long' });
  const sabado = new Date(dia.getTime() + (((6 - dia.getUTCDay()) + 7) % 7) * 86400000);
  // Un domingo, "este fin de semana" es hoy mismo
  if (dia.getUTCDay() === 0) sabado.setTime(dia.getTime() - 86400000);
  const domingo = new Date(sabado.getTime() + 86400000);
  return { hoy: largo(dia), finde: `sábado ${corto(sabado)} y domingo ${corto(domingo)}` };
}

const HERRAMIENTAS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: 'ver_citas',
    description: 'Las citas de la pareja. "proximas": confirmadas o por confirmar desde hoy. "pasadas": las ya vividas, de la más reciente a la más vieja.',
    input_schema: { type: 'object', properties: { cuales: { type: 'string', enum: ['proximas', 'pasadas'] } }, required: ['cuales'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'buscar_recuerdos',
    description: 'Recuerdos guardados (título, fecha, lugar, lo que escribieron y la calificación en corazones de 1 a 5). Filtra por texto o por año; sin filtros trae los más recientes.',
    input_schema: { type: 'object', properties: { texto: { type: 'string' }, anio: { type: 'string' } }, required: [], additionalProperties: false },
  },
  {
    name: 'ver_respuestas',
    description: 'Preguntas del día y lo que respondió cada uno (solo las que ya se pueden ver). Sirve para saber gustos, sueños y cosas de cada uno. Filtra por una palabra.',
    input_schema: { type: 'object', properties: { texto: { type: 'string' } }, required: [], additionalProperties: false },
  },
  {
    name: 'ver_lugares',
    description: '"catalogo": lugares de Bogotá que la app tiene para citas (zona, tipo de plan, precio de 1 a 4). "por_conocer": los que ellos marcaron en el mapa porque quieren ir.',
    input_schema: { type: 'object', properties: { cuales: { type: 'string', enum: ['catalogo', 'por_conocer'] } }, required: ['cuales'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'ver_listas',
    description: 'Planes pendientes por hacer juntos, pelis y series por ver, el reto del mes y cómo se han sentido estos últimos días.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'ver_clima',
    description: 'Pronóstico del clima en Bogotá para una fecha (YYYY-MM-DD) dentro de los próximos 14 días.',
    input_schema: { type: 'object', properties: { fecha: { type: 'string' } }, required: ['fecha'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'sugerir_accion',
    description: 'Deja un botón debajo de tu respuesta para que la persona lo haga con un toque: planear_cita (abre el asistente de citas con esa idea), agregar_plan (lo agrega a "Planes" de Juntos), agregar_peli, escribir_carta (abre Cartas con un título), regalar_cupon. Úsala cuando propongas algo concreto; máximo 3 por respuesta.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['planear_cita', 'agregar_plan', 'agregar_peli', 'escribir_carta', 'regalar_cupon'] },
        titulo: { type: 'string', description: 'Corto, como quedaría escrito en la app (máx. 60 caracteres)' },
        detalle: { type: 'string', description: 'Opcional: una línea con el porqué o los detalles' },
        texto: { type: 'string', description: 'Solo para escribir_carta: el borrador completo de la carta, en primera persona, para que lo ajuste' },
      },
      required: ['tipo', 'titulo'],
      additionalProperties: false,
    },
  },
  {
    type: 'web_search_20260209',
    name: 'web_search',
    max_uses: 3,
    user_location: { type: 'approximate', city: 'Bogotá', region: 'Bogotá D.C.', country: 'CO', timezone: 'America/Bogota' },
  },
];

/** El cliente de la API no lleva los tipos de la base: aquí van, mínimas, solo las columnas que lee el asistente. */
type CitaParaAsistente = { fecha: string | null; estado: string; es_cita_sorpresa: boolean; hora_confirmada: string | null; lugar_personalizado: string | null; creada_por: string; lugares: { nombre: string; zona: string } | null; actividades: { nombre: string } | null; franjas: { nombre: string } | null };
type RespuestaParaAsistente = { texto: string; usuario_id: string; preguntas: { texto: string } | null };
/** La fila que devuelve el rpc reto_del_mes */
type RetoActual = { texto: string; cumplido_en: string | null };
/** Argumentos que el modelo le pasa a una herramienta, tal como llegan del JSON */
type EntradaHerramienta = { cuales?: string; texto?: string; anio?: string; fecha?: string };

export async function ejecutar(db: SupabaseClient, yo: string, esAdmin: boolean, nombre: string, input: EntradaHerramienta): Promise<string> {
  const hoy = hoyBogota();
  switch (nombre) {
    case 'ver_citas': {
      const q = db.from('citas').select('fecha, estado, es_cita_sorpresa, hora_confirmada, lugar_personalizado, creada_por, lugares(nombre, zona), actividades(nombre), franjas(nombre)');
      const { data } = input.cuales === 'pasadas'
        ? await q.eq('estado', 'vivida').order('fecha', { ascending: false }).limit(25)
        : await q.in('estado', ['pendiente', 'confirmada']).gte('fecha', hoy).order('fecha').limit(15);
      // Si es sorpresa, solo quien tiene el permiso de admin sabe a dónde van
      return JSON.stringify(((data ?? []) as unknown as CitaParaAsistente[]).map((c) => {
        const oculto = c.es_cita_sorpresa && !esAdmin && c.creada_por !== yo;
        return {
          fecha: c.fecha, estado: c.estado, hora: c.hora_confirmada, momento: c.franjas?.nombre,
          lugar: oculto ? 'Sorpresa (no reveles nada)' : c.lugares?.nombre ?? c.lugar_personalizado, zona: oculto ? null : c.lugares?.zona,
          plan: oculto ? null : c.actividades?.nombre,
        };
      }));
    }
    case 'buscar_recuerdos': {
      let q = db.from('recuerdos').select('titulo, fecha, lugar_texto, descripcion, calificacion').order('fecha', { ascending: false }).limit(30);
      if (input.texto) q = q.or(`titulo.ilike.%${String(input.texto).replace(/[%,()]/g, '')}%,descripcion.ilike.%${String(input.texto).replace(/[%,()]/g, '')}%,lugar_texto.ilike.%${String(input.texto).replace(/[%,()]/g, '')}%`);
      if (input.anio && /^\d{4}$/.test(input.anio)) q = q.gte('fecha', `${input.anio}-01-01`).lte('fecha', `${input.anio}-12-31`);
      const { data } = await q;
      return JSON.stringify(data ?? []);
    }
    case 'ver_respuestas': {
      const { data } = await db.from('respuestas').select('texto, usuario_id, created_at, preguntas(texto)').order('created_at', { ascending: false }).limit(80);
      const filtro = String(input.texto ?? '').toLowerCase();
      const filas = ((data ?? []) as unknown as RespuestaParaAsistente[]).map((r) => ({ pregunta: r.preguntas?.texto, quien: r.usuario_id === yo ? 'tú' : 'tu pareja', respuesta: r.texto }))
        .filter((r) => !filtro || `${r.pregunta} ${r.respuesta}`.toLowerCase().includes(filtro));
      return JSON.stringify(filas.slice(0, 40));
    }
    case 'ver_lugares': {
      if (input.cuales === 'por_conocer') {
        const { data } = await db.from('lugares_por_conocer').select('nombre, direccion, nota').order('created_at', { ascending: false }).limit(40);
        return JSON.stringify(data ?? []);
      }
      const { data } = await db.from('lugares').select('nombre, zona, descripcion, categorias, precio, duracion').eq('activo', true).eq('es_sorpresa', false).limit(80);
      return JSON.stringify(data ?? []);
    }
    case 'ver_listas': {
      const hace7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const [planes, pelis, reto, animo] = await Promise.all([
        db.from('suenos').select('titulo').is('cumplido_en', null).limit(40),
        db.from('pelis').select('titulo, tipo, donde').is('vista_en', null).limit(40),
        db.rpc('reto_del_mes'),
        db.from('estados_animo').select('usuario_id, fecha, etiqueta').gte('fecha', hace7).order('fecha', { ascending: false }),
      ]);
      const filasReto = (reto.data ?? []) as RetoActual[];
      return JSON.stringify({
        planes_por_cumplir: ((planes.data ?? []) as { titulo: string }[]).map((p) => p.titulo),
        pelis_por_ver: pelis.data ?? [],
        reto_del_mes: filasReto[0] ? { reto: filasReto[0].texto, cumplido: !!filasReto[0].cumplido_en } : null,
        animo_ultimos_dias: ((animo.data ?? []) as { usuario_id: string; fecha: string; etiqueta: string }[]).map((a) => ({ quien: a.usuario_id === yo ? 'tú' : 'tu pareja', fecha: a.fecha, como: a.etiqueta })),
      });
    }
    case 'ver_clima': {
      if (!input.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) return 'Fecha inválida';
      try {
        const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=4.711&longitude=-74.0721&timezone=America%2FBogota&start_date=${input.fecha}&end_date=${input.fecha}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode`)).json();
        if (!j.daily) return 'No hay pronóstico para esa fecha (solo los próximos 14 días).';
        return JSON.stringify({ max: j.daily.temperature_2m_max[0], min: j.daily.temperature_2m_min[0], probabilidad_lluvia: j.daily.precipitation_probability_max[0], codigo_wmo: j.daily.weathercode[0] });
      } catch {
        return 'No pude consultar el clima ahora.';
      }
    }
    default:
      return 'Herramienta desconocida';
  }
}

const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status });

export class ErrorAsistente extends Error {
  codigo: 'ocupado' | 'fallo' | 'sin_clave';
  constructor(codigo: 'ocupado' | 'fallo' | 'sin_clave') { super(codigo); this.codigo = codigo; }
}

type Turno = { rol: 'user' | 'assistant'; contenido: string };
/** Lo que viene de una conversación en el celular, tal como la guarda el celular (sin validar) */
type TurnoGuardado = { rol?: string; contenido?: string };
type Herramienta = (nombre: string, input: EntradaHerramienta) => Promise<string>;
type Resultado = { texto: string; rechazo: boolean };

// sugerir_accion no se ejecuta: se anota para dejar el botón
function anotarAccion(acciones: Accion[], a: Accion) {
  if (acciones.length < 3 && a?.titulo) {
    acciones.push({
      tipo: a.tipo, titulo: String(a.titulo).slice(0, 60),
      detalle: a.detalle ? String(a.detalle).slice(0, 140) : undefined,
      texto: a.tipo === 'escribir_carta' && a.texto ? String(a.texto).slice(0, 5000) : undefined,
    });
  }
  return 'Listo: el botón queda debajo de tu respuesta.';
}

const TIPOS_ACCION = new Set<Accion['tipo']>(['planear_cita', 'agregar_plan', 'agregar_peli', 'escribir_carta', 'regalar_cupon']);

/** ¿El objeto trae una acción que la app sabe crear? (tipo de la lista y con título) */
const esAccion = (a: unknown): a is Accion =>
  !!a && typeof a === 'object' && 'tipo' in a && 'titulo' in a
  && TIPOS_ACCION.has(a.tipo as Accion['tipo']) && !!a.titulo;

// A veces un modelo escribe las acciones como JSON en el texto en vez de llamar sugerir_accion:
// se convierten en botones y el bloque se quita, para que no se vea código en el chat
export function rescatarAcciones(texto: string, acciones: Accion[]): string {
  return texto.replace(/```(?:json)?\s*([\s\S]*?)```/g, (bloque, adentro: string) => {
    const objetos = adentro.match(/\{[^{}]*\}/g) ?? [];
    let alguna = false;
    for (const o of objetos) {
      try {
        const a: unknown = JSON.parse(o);
        if (esAccion(a)) { anotarAccion(acciones, a); alguna = true; }
      } catch {}
    }
    return alguna ? '' : bloque;
  })
    // También sueltas en el texto, como [Planear cita]({ "tipo": "planear_cita", ... })
    .replace(/\{[^{}]*"tipo"\s*:[^{}]*\}/g, (o) => {
      try {
        const a: unknown = JSON.parse(o);
        if (esAccion(a)) { anotarAccion(acciones, a); return ''; }
      } catch {}
      return o;
    })
    // O como etiqueta: <sugerir_accion tipo="planear_cita" titulo="..." detalle="..." />
    .replace(/<sugerir_accion\b([^>]*?)\/?>(?:\s*<\/sugerir_accion>)?/gi, (etiqueta, atributos: string) => {
      const a = Object.fromEntries([...atributos.matchAll(/(\w+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
      if (esAccion(a)) { anotarAccion(acciones, a); return ''; }
      return etiqueta;
    })
    .replace(/\n{3,}/g, '\n\n').trim();
}

// El chat no dibuja tablas ni separadores (---): las tablas pasan a lista, una fila por línea
export function sinTablas(t: string): string {
  const salida: string[] = [];
  const lineas = t.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    if (!/^\s*\|/.test(lineas[i])) {
      if (!/^\s*([-*_]\s*){3,}$/.test(lineas[i])) salida.push(lineas[i]);
      continue;
    }
    const filas: string[][] = [];
    for (; i < lineas.length && /^\s*\|/.test(lineas[i]); i++) {
      if (/^\s*\|?[\s:|-]+$/.test(lineas[i])) continue; // la línea |---|---|
      filas.push(lineas[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    }
    i--;
    // La primera fila son los títulos de las columnas: sobran en la lista
    for (const celdas of filas.slice(filas.length > 1 ? 1 : 0)) {
      const [primera, ...resto] = celdas.filter((c) => c && !/^[–—-]$/.test(c));
      if (primera) salida.push(`- ${primera}${resto.length ? `: ${resto.join(' · ')}` : ''}`);
    }
  }
  return salida.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Botones escritos como texto, que en el chat no se pueden tocar: "**[Planear cita – “X”]**",
// "*(Botón para crear la cita)*", o una lista "Acciones sugeridas" con "- **planear_cita** – …"
const LINEAS_BOTON = [
  /^\W*\[\s*(planear|agregar|escribir|regalar)[^\]]*\]/i,
  /^[\s*_(]*bot[oó]n(es)?\b/i,
  // Una línea que solo es un paréntesis hablando del botón: "(Se mostrará el botón para que elijan)."
  /^[\s*_]*\([^)]*bot[oó]n[^)]*\)[\s*_.]*$/i,
  /^[\s*_#]*acciones (sugeridas|rápidas)\W*$/i,
  /^\s*[-*•]\s*[*`]*(planear[ _]cita|agregar[ _]plan|agregar[ _]peli|escribir[ _]carta|regalar[ _]cup[oó]n)[*`]*\s*[:–—-]/i,
];
const esLineaBoton = (l: string) => LINEAS_BOTON.some((r) => r.test(l));
export const tieneBotonesEscritos = (t: string) => t.split('\n').some(esLineaBoton);
export function quitarBotonesEscritos(t: string): string {
  const lineas = t.split('\n').filter((l) => !esLineaBoton(l));
  // Los separadores (---) que quedan sueltos al final, donde estaban los botones
  while (lineas.length && /^\s*([-*_]{3,})?\s*$/.test(lineas[lineas.length - 1])) lineas.pop();
  return lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------- Con Claude (si hay ANTHROPIC_API_KEY) ---------- */
async function conClaude(clave: string, sistema: string, historia: Turno[], acciones: Accion[], herramienta: Herramienta, conHerramientas = true): Promise<Resultado> {
  const client = new Anthropic({ apiKey: clave, timeout: 50_000, maxRetries: 1 });
  const mensajes: Anthropic.Beta.BetaMessageParam[] = historia.map((m) => ({ role: m.rol, content: m.contenido }));
  let respuesta: Anthropic.Beta.BetaMessage | null = null;
  try {
    for (let vuelta = 0; vuelta < 6; vuelta++) {
      respuesta = await client.beta.messages.create({
        model: MODELO,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        cache_control: { type: 'ephemeral' },
        system: sistema,
        ...(conHerramientas ? { tools: HERRAMIENTAS } : {}),
        messages: mensajes,
      });
      if (respuesta.stop_reason === 'pause_turn') { mensajes.push({ role: 'assistant', content: respuesta.content }); continue; }
      if (respuesta.stop_reason !== 'tool_use') break;

      mensajes.push({ role: 'assistant', content: respuesta.content });
      const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const b of respuesta.content) {
        if (b.type !== 'tool_use') continue;
        const content = b.name === 'sugerir_accion' ? anotarAccion(acciones, b.input as Accion) : await herramienta(b.name, b.input as EntradaHerramienta);
        resultados.push({ type: 'tool_result', tool_use_id: b.id, content });
      }
      mensajes.push({ role: 'user', content: resultados });
    }
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new ErrorAsistente('ocupado');
    if (e instanceof Anthropic.AuthenticationError) throw new ErrorAsistente('sin_clave');
    if (e instanceof Anthropic.APIError) { console.error('asistente claude', e.status, e.message); throw new ErrorAsistente('fallo'); }
    throw e;
  }
  if (respuesta?.stop_reason === 'refusal') return { texto: '', rechazo: true };
  return { texto: (respuesta?.content ?? []).filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('').trim(), rechazo: false };
}

/* ---------- Rotación de claves y modelos (Groq y Gemini) ---------- */
// Lo que se va aprendiendo durante una misma pregunta, para no repetir intentos que ya fallaron
export type MemoriaRotacion = {
  agotadas: Set<string>; // "modelo|clave" sin cuota (la cuota gratis es por modelo)
  clavesMalas: Set<string>; // clave inválida o sin permiso: no sirve con ningún modelo
  modelosCaidos: Set<string>; // saturado, no existe, pedido muy grande o no contestó a tiempo
  buena?: { modelo: string; clave: string }; // la última que respondió: se prueba primero
};
export const memoriaNueva = (): MemoriaRotacion => ({ agotadas: new Set(), clavesMalas: new Set(), modelosCaidos: new Set() });

type Servicio = {
  nombre: string;
  modelos: string[];
  pedido: (modelo: string, clave: string) => { url: string; headers: Record<string, string>; body: unknown };
};

// Recorre modelo por modelo y, en cada uno, clave por clave, hasta que alguno conteste.
// <T>: en JSON llega lo que cada servicio promete; quien llama declara qué lee de él
export async function pedirRotando<T = unknown>(servicio: Servicio, claves: string[], limite: number, memoria: MemoriaRotacion, pedir: typeof fetch = fetch): Promise<T> {
  const intentos = servicio.modelos.flatMap((modelo) => claves.map((clave) => ({ modelo, clave })));
  if (memoria.buena) intentos.unshift(memoria.buena);
  const probados = new Set<string>();
  for (const { modelo, clave } of intentos) {
    const par = `${modelo}|${clave}`;
    if (probados.has(par) || memoria.agotadas.has(par) || memoria.clavesMalas.has(clave) || memoria.modelosCaidos.has(modelo)) continue;
    probados.add(par);
    const queda = limite - Date.now();
    if (queda < 4000) break;
    const { url, headers, body } = servicio.pedido(modelo, clave);
    try {
      const r = await pedir(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(20_000, queda - 2000)),
      });
      if (r.ok) { memoria.buena = { modelo, clave }; return (await r.json()) as T; }
      console.warn(servicio.nombre, modelo, r.status);
      if (memoria.buena?.modelo === modelo && memoria.buena.clave === clave) memoria.buena = undefined;
      if (r.status === 429) memoria.agotadas.add(par);
      else if (r.status === 401 || r.status === 403) memoria.clavesMalas.add(clave);
      // 413: el pedido no cabe en el límite por minuto de ese modelo
      else if (r.status === 404 || r.status === 413 || r.status >= 500) memoria.modelosCaidos.add(modelo);
      else { console.error(servicio.nombre, modelo, r.status, (await r.text()).slice(0, 300)); throw new ErrorAsistente('fallo'); }
    } catch (e) {
      if (e instanceof ErrorAsistente) throw e;
      // No contestó a tiempo: ese modelo está lento, se pasa al siguiente
      console.warn(servicio.nombre, modelo, 'sin respuesta a tiempo');
      memoria.modelosCaidos.add(modelo);
    }
  }
  throw new ErrorAsistente('ocupado');
}

/** Esquema JSON abierto: lo que la app necesita clonar de los esquemas de herramientas */
type Esquema = { additionalProperties?: unknown; properties?: Record<string, unknown> } & Record<string, unknown>;

// Los esquemas de Claude en el formato de funciones de los demás: sin strict ni additionalProperties
function esquemaSimple(s: Esquema): Esquema {
  if (!s || typeof s !== 'object') return s;
  const { additionalProperties: _a, ...resto } = s;
  if (resto.properties) resto.properties = Object.fromEntries(Object.entries(resto.properties).map(([k, v]) => [k, esquemaSimple(v as Esquema)]));
  return resto;
}
// Solo las funciones de la app: la búsqueda web de cada servicio se agrega aparte
const FUNCIONES = HERRAMIENTAS.filter((h): h is Anthropic.Beta.BetaTool => 'input_schema' in h);

/* ---------- Con Groq (gratis, primera alternativa) ---------- */
// Cada clave gratis da unos 1.000 pedidos al día pero solo 8.000 tokens por minuto:
// por eso con Groq va menos historia y los resultados de las herramientas recortados
const MODELOS_GROQ = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
const GROQ_HISTORIA = 8;
const GROQ_TURNO = 1500;
const GROQ_RESULTADO = 5000;

// browser_search la ejecuta Groq por dentro (gratis con gpt-oss): no llega como tool_call
const FUNCIONES_APP_GROQ = FUNCIONES.map((h) => ({
  type: 'function' as const,
  function: { name: h.name, description: h.description, parameters: esquemaSimple(h.input_schema as Esquema) },
}));
const FUNCIONES_GROQ = [{ type: 'browser_search' as const }, ...FUNCIONES_APP_GROQ];
const SOLO_SUGERIR_GROQ = FUNCIONES_APP_GROQ.filter((f) => f.function.name === 'sugerir_accion');

export const pedirGroq = <T = unknown>(claves: string[], cuerpo: object, limite: number, memoria: MemoriaRotacion, pedir: typeof fetch = fetch) =>
  pedirRotando<T>({
    nombre: 'groq',
    modelos: MODELOS_GROQ,
    pedido: (modelo, clave) => ({ url: 'https://api.groq.com/openai/v1/chat/completions', headers: { Authorization: `Bearer ${clave}` }, body: { ...cuerpo, model: modelo } }),
  }, claves, limite, memoria, pedir);

const recortar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n)}…` : t);

// La búsqueda de Groq deja marcas de cita como 【0†L28-L46】 que en el chat no significan nada
export const quitarMarcasDeCita = (t: string) => t.replace(/ ?【[^】]*】/g, '');

/** Lo que la app lee de la conversación con Groq (formato OpenAI) */
type MensajeGroq = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
  tool_call_id?: string;
};
type RespuestaGroq = { choices?: { finish_reason?: string; message?: MensajeGroq | null }[] };

export async function conGroq(claves: string[], sistema: string, historia: Turno[], acciones: Accion[], herramienta: Herramienta, limite: number, conHerramientas = true): Promise<Resultado> {
  const messages: MensajeGroq[] = [
    { role: 'system', content: sistema },
    ...historia.slice(-GROQ_HISTORIA).map((m) => ({ role: m.rol, content: recortar(m.contenido, GROQ_TURNO) })),
  ];
  const memoria = memoriaNueva();
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const r = await pedirGroq<RespuestaGroq>(claves, {
      messages,
      ...(conHerramientas ? { tools: FUNCIONES_GROQ, tool_choice: 'auto' } : {}),
      reasoning_effort: 'low',
      max_completion_tokens: 1500,
    }, limite, memoria);
    const eleccion = r.choices?.[0];
    if (!eleccion || eleccion.finish_reason === 'content_filter') return { texto: '', rechazo: true };
    const msg = eleccion.message;
    const llamadas = msg?.tool_calls ?? [];
    if (!llamadas.length) {
      const texto = rescatarAcciones(quitarMarcasDeCita(String(msg?.content ?? '')), acciones);
      // A veces vuelve sin nada (la búsqueda se comió los tokens): mejor que conteste el siguiente
      if (!texto && !acciones.length) throw new ErrorAsistente('ocupado');
      // Después de buscar, a veces escribe los botones en vez de llamar sugerir_accion:
      // una vuelta corta, sin búsqueda, para que los cree de verdad
      if (!acciones.length && tieneBotonesEscritos(texto)) await botonesQueFaltan(claves, messages, texto, acciones, limite, memoria);
      return { texto, rechazo: false };
    }

    // El razonamiento no se devuelve: solo lo que dijo y las herramientas que pidió
    messages.push({ role: 'assistant', content: msg?.content ?? '', tool_calls: llamadas });
    for (const l of llamadas) {
      let args: unknown = {};
      try { args = JSON.parse(l.function?.arguments || '{}'); } catch {}
      const nombre = String(l.function?.name ?? '');
      const resultado = nombre === 'sugerir_accion' ? anotarAccion(acciones, args as Accion) : await herramienta(nombre, args as EntradaHerramienta);
      messages.push({ role: 'tool', tool_call_id: l.id, content: recortar(resultado, GROQ_RESULTADO) });
    }
  }
  return { texto: '', rechazo: false };
}

async function botonesQueFaltan(claves: string[], messages: MensajeGroq[], texto: string, acciones: Accion[], limite: number, memoria: MemoriaRotacion) {
  try {
    const r = await pedirGroq<RespuestaGroq>(claves, {
      messages: [
        ...messages,
        { role: 'assistant', content: texto },
        { role: 'user', content: '(Mensaje automático de la app, no de la persona) Escribiste los botones como texto y así no aparecen. Llama ahora sugerir_accion una vez por cada propuesta concreta de tu respuesta anterior (máximo 3), con títulos cortos. No escribas nada más.' },
      ],
      tools: SOLO_SUGERIR_GROQ,
      tool_choice: 'required',
      reasoning_effort: 'low',
      max_completion_tokens: 1500,
    }, limite, memoria);
    for (const l of r.choices?.[0]?.message?.tool_calls ?? []) {
      if (l.function?.name !== 'sugerir_accion') continue;
      try { anotarAccion(acciones, JSON.parse(l.function.arguments || '{}')); } catch {}
    }
  } catch (e) {
    // Sin botones no se pierde la respuesta: se entrega igual
    console.warn('groq: no se pudieron crear los botones', e instanceof ErrorAsistente ? e.codigo : e);
  }
}

/* ---------- Con Gemini (gratis, segunda alternativa) ---------- */
// En orden: si uno está saturado o se acabó su cuota, se prueba el siguiente
const MODELOS_GEMINI = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];

const FUNCIONES_GEMINI = FUNCIONES.map((h) => ({
  name: h.name,
  description: h.description,
  // Sin propiedades, Gemini prefiere que no vaya el esquema
  ...(Object.keys((h.input_schema as Esquema).properties ?? {}).length ? { parameters: esquemaSimple(h.input_schema as Esquema) } : {}),
}));

export const pedirGemini = <T = unknown>(claves: string[], cuerpo: unknown, limite: number, memoria: MemoriaRotacion, pedir: typeof fetch = fetch) =>
  pedirRotando<T>({
    nombre: 'gemini',
    modelos: MODELOS_GEMINI,
    pedido: (modelo, clave) => ({ url: `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, headers: { 'x-goog-api-key': clave }, body: cuerpo }),
  }, claves, limite, memoria, pedir);

/** Lo que la app lee de la conversación con Gemini */
type ParteGemini = { text?: string; thought?: boolean; functionCall?: { name: string; args?: object }; functionResponse?: { name: string; response: { resultado: string } } };
type ContenidoGemini = { role: 'user' | 'model'; parts: ParteGemini[] };
type RespuestaGemini = { candidates?: { finishReason?: string; content?: { parts?: ParteGemini[] } | null }[] };

export async function conGemini(claves: string[], sistema: string, historia: Turno[], acciones: Accion[], herramienta: Herramienta, limite: number, conHerramientas = true): Promise<Resultado> {
  const contents: ContenidoGemini[] = historia.map((m) => ({ role: m.rol === 'assistant' ? 'model' : 'user', parts: [{ text: m.contenido }] }));
  const memoria = memoriaNueva();
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const r = await pedirGemini<RespuestaGemini>(claves, {
      systemInstruction: { parts: [{ text: sistema }] },
      contents,
      ...(conHerramientas ? { tools: [{ functionDeclarations: FUNCIONES_GEMINI }] } : {}),
      generationConfig: { maxOutputTokens: 4000 },
    }, limite, memoria);
    const candidato = r.candidates?.[0];
    if (!candidato || ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(candidato.finishReason ?? '')) return { texto: '', rechazo: true };
    const partes: ParteGemini[] = candidato.content?.parts ?? [];
    const llamadas = partes.filter((p): p is ParteGemini & { functionCall: { name: string; args?: object } } => !!p.functionCall);
    if (!llamadas.length) return { texto: partes.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim(), rechazo: false };

    // Las partes vuelven tal cual (con su thoughtSignature): Gemini las necesita para seguir
    contents.push({ role: 'model', parts: partes });
    const respuestas: ParteGemini[] = [];
    for (const p of llamadas) {
      const { name, args } = p.functionCall;
      const resultado = name === 'sugerir_accion' ? anotarAccion(acciones, args as Accion) : await herramienta(name, (args ?? {}) as EntradaHerramienta);
      respuestas.push({ functionResponse: { name, response: { resultado } } });
    }
    contents.push({ role: 'user', parts: respuestas });
  }
  return { texto: '', rechazo: false };
}

/* ---------- Desde Aprender, en la sección del ciclo ---------- */
// Preguntas generales sobre el ciclo menstrual. Payakan no ve nada de la sección (está cifrada): solo le llega
// lo que la persona escribe y la conversación corta de esa pantalla. Aquí no se guarda nada: el historial lo
// guarda el celular cifrado con la llave del ciclo, aparte del chat. No usa herramientas, así que tampoco lee
// citas, recuerdos ni nada más de la pareja
const CICLO_HISTORIA = 8;

export function historiaDelCiclo(previa: unknown, texto: string): Turno[] {
  const lista = (Array.isArray(previa) ? previa : []) as TurnoGuardado[];
  const turnos: Turno[] = lista
    .filter((m): m is Turno => (m.rol === 'user' || m.rol === 'assistant') && typeof m.contenido === 'string' && !!m.contenido.trim())
    .map((m) => ({ rol: m.rol, contenido: String(m.contenido).slice(0, 2000) }))
    .slice(-CICLO_HISTORIA);
  while (turnos.length && turnos[0].rol !== 'user') turnos.shift();
  turnos.push({ rol: 'user', contenido: texto });
  return turnos;
}

async function sobreElCiclo(db: SupabaseClient, uid: string, texto: string, previa: unknown, inicio: number,
  { ANTHROPIC_API_KEY, clavesGroq, clavesGemini }: { ANTHROPIC_API_KEY?: string; clavesGroq: string[]; clavesGemini: string[] }) {
  const [{ data: cfg }, { data: perfiles }] = await Promise.all([
    db.from('configuracion').select('nombre_el, nombre_ella').eq('id', 1).single(),
    db.from('perfiles').select('id, rol'),
  ]);
  const soyEl = ((perfiles ?? []) as { id: string; rol: string }[]).find((p) => p.id === uid)?.rol === 'admin';
  const ella = cfg?.nombre_ella ?? 'ella';
  const el = cfg?.nombre_el ?? 'él';
  const sistema = `Eres Payakan, el asistente de You and me, la app privada de ${el} y ${ella} (tu nombre es el del tulkun de Avatar). Ahora estás dentro de la sección "Ciclo", en "Aprender", y hablas con ${soyEl ? `${el}, que quiere entender el ciclo de ${ella} y acompañarla mejor` : `${ella}, sobre su propio ciclo menstrual`}.
Hoy es ${fechasParaElSistema(hoyBogota()).hoy}.

Cómo responder:
- Español de Colombia, cálido, sin juicios y breve: lo leen en el celular. Párrafos cortos o listas cortas, sin títulos, sin tablas y sin separadores.
- Explica el ciclo con información de salud confiable y actual (guías de ginecología como las de ACOG o la OMS): fases, hormonas, síntomas, SPM, cólicos, ánimo, energía, sueño, alimentación, ejercicio, fertilidad, anticonceptivos y ciclos irregulares. Nada de mitos.
- No ves los registros de la sección: están cifrados y no te llegan. Si te cuentan en qué fase van o qué sienten, úsalo; si no, no lo supongas.
${soyEl ? `- Con ${el}, ayúdale a acompañar: ideas concretas de qué hacer o decir, cómo preguntarle a ${ella} cómo está y respetar lo que ella quiera. Lo que suele pasar en una fase no es lo que ella siente: recuérdale preguntarle.` : `- Con ${ella}, valida lo que siente y dale ideas prácticas para sentirse mejor.`}
- No diagnostiques ni recetes. Si algo suena a señal de alarma (dolor que no deja hacer la vida normal, sangrado que empapa una toalla en una hora, un periodo que no llega y podría haber embarazo, fiebre con dolor pélvico), di con calma que vale la pena consultar y por qué.
- No inventes datos ni porcentajes. Si no sabes algo, dilo.`;

  const historia = historiaDelCiclo(previa, texto);
  const ninguna: Herramienta = async () => '';
  const acciones: Accion[] = [];
  const limite = inicio + 55_000;
  const proveedores: [string, () => Promise<Resultado>][] = [];
  if (ANTHROPIC_API_KEY) proveedores.push(['claude', () => conClaude(ANTHROPIC_API_KEY, sistema, historia, acciones, ninguna, false)]);
  if (clavesGroq.length) proveedores.push(['groq', () => conGroq(clavesGroq, sistema, historia, acciones, ninguna, limite, false)]);
  if (clavesGemini.length) proveedores.push(['gemini', () => conGemini(clavesGemini, sistema, historia, acciones, ninguna, limite, false)]);

  let resultado: Resultado | null = null;
  let codigo: ErrorAsistente['codigo'] = 'fallo';
  for (const [nombre, pedirle] of proveedores) {
    if (limite - Date.now() < 8000) break;
    try {
      resultado = await pedirle();
      break;
    } catch (e) {
      codigo = e instanceof ErrorAsistente ? e.codigo : 'fallo';
      console.warn('asistente ciclo: falló', nombre, codigo, e instanceof ErrorAsistente ? '' : e);
    }
  }
  if (!resultado) return json({ error: codigo }, codigo === 'fallo' ? 502 : 503);
  const salida = resultado.rechazo ? 'Uy, con eso no te puedo ayudar 🐋 ¿Probamos con otra pregunta?' : sinTablas(resultado.texto) || 'Me quedé pensando y no encontré qué decir 🐋 ¿Me lo preguntas de otra forma?';
  return json({ texto: salida });
}

// El título de una conversación nueva: su primera pregunta, en una línea y corta
export function tituloDe(texto: string): string {
  const linea = texto.replace(/\s+/g, ' ').trim();
  return (linea.length > 60 ? `${linea.slice(0, 57).trimEnd()}…` : linea) || 'Conversación';
}

/* ---------- La petición ---------- */
export async function POST(request: Request) {
  const inicio = Date.now();
  const { ANTHROPIC_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env;
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) return json({ error: 'config' }, 500);
  const lista = (v?: string) => (v ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  const clavesGroq = lista(GROQ_API_KEY);
  const clavesGemini = lista(GEMINI_API_KEY);

  // Solo con sesión de la app
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'sin_sesion' }, 401);
  const db = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return json({ error: 'sin_sesion' }, 401);
  if (!ANTHROPIC_API_KEY && !clavesGroq.length && !clavesGemini.length) return json({ error: 'sin_clave' }, 503);

  const { mensaje, modo, historia: previa, conversacion } = (await request.json().catch(() => ({}))) as { mensaje?: string; modo?: string; historia?: unknown; conversacion?: string };
  const texto = String(mensaje ?? '').trim().slice(0, 2000);
  if (!texto) return json({ error: 'vacio' }, 400);

  const { data: llevaHoy } = await db.rpc('preguntas_al_asistente_hoy');
  if ((llevaHoy ?? 0) >= TOPE_DIARIO) return json({ error: 'tope' }, 429);

  if (modo === 'ciclo') return await sobreElCiclo(db, user.id, texto, previa, inicio, { ANTHROPIC_API_KEY, clavesGroq, clavesGemini });

  // Cada pregunta va en una conversación: la que está abierta o una nueva con la pregunta como título
  let conversacionId = typeof conversacion === 'string' && /^[0-9a-f-]{36}$/i.test(conversacion) ? conversacion : null;
  if (conversacionId) {
    const { data: existe } = await db.from('asistente_conversaciones').select('id').eq('id', conversacionId).maybeSingle();
    if (!existe) conversacionId = null;
  }
  if (!conversacionId) {
    const { data: nueva, error } = await db.from('asistente_conversaciones').insert({ titulo: tituloDe(texto) }).select('id').single();
    if (error || !nueva) return json({ error: 'fallo' }, 500);
    conversacionId = nueva.id as string;
  }

  const [{ data: cfg }, { data: perfiles }, { data: permiso }, { data: previos }] = await Promise.all([
    db.from('configuracion').select('nombre_el, nombre_ella, apodo_ella, fecha_inicio, cumple_el, cumple_ella').eq('id', 1).single(),
    db.from('perfiles').select('id, nombre, rol'),
    db.from('permisos').select('es_admin').eq('usuario_id', user.id).maybeSingle(),
    db.from('asistente_mensajes').select('rol, contenido').eq('conversacion_id', conversacionId).order('created_at', { ascending: false }).limit(HISTORIA),
  ]);
  const yo = ((perfiles ?? []) as { id: string; rol: string; nombre: string }[]).find((p) => p.id === user.id);
  const soyEl = yo?.rol === 'admin';
  const miNombre = (soyEl ? cfg?.nombre_el : cfg?.nombre_ella) ?? yo?.nombre ?? '';
  const pareja = (soyEl ? cfg?.nombre_ella : cfg?.nombre_el) ?? 'tu pareja';
  const esAdmin = !!permiso?.es_admin;

  await db.from('asistente_mensajes').insert({ conversacion_id: conversacionId, rol: 'user', contenido: texto });

  // El sistema no cambia entre preguntas del mismo día: así se aprovecha el caché.
  // Gemini no busca en internet: a él se le pide que no invente precios ni horarios
  const fechas = fechasParaElSistema(hoyBogota());
  const armarSistema = (conBusqueda: boolean) => `Eres Payakan, el asistente de You and me (tu nombre es el del tulkun de Avatar: a ${cfg?.nombre_ella ?? 'ella'} le encantan las ballenas). You and me es la app privada de ${cfg?.nombre_el ?? 'él'} y ${cfg?.nombre_ella ?? 'ella'}, una pareja que vive en Bogotá. Están juntos desde el ${cfg?.fecha_inicio ?? '(sin fecha)'}. Cumpleaños: ${cfg?.nombre_el} el ${cfg?.cumple_el ?? '?'}, ${cfg?.nombre_ella} el ${cfg?.cumple_ella ?? '?'}. A ${cfg?.nombre_ella} le dicen "${cfg?.apodo_ella ?? 'Ma vie'}" y le encantan las ballenas azules.
Hoy es ${fechas.hoy} (${hoyBogota()}, hora de Bogotá). "Este fin de semana" es el ${fechas.finde}. Hablas con ${miNombre}; su pareja es ${pareja}.

Cómo responder:
- Español de Colombia, cálido, cercano y breve: lo leen en el celular. Párrafos cortos o listas cortas, sin títulos grandes, sin tablas, sin separadores (---) y sin bloques de código.
- Ayudas a planear citas y sorpresas, a elegir regalos, a escribir cartas o mensajes, a recordar lo que han vivido y a cuidar la relación.
- No toman alcohol: nunca propongas bares, vino, cócteles ni planes alrededor de tragos. Salen en Bogotá; no propongas pueblos ni viajes fuera salvo que te lo pidan.
- Antes de recomendar, mira sus datos con las herramientas (lugares por conocer, lo que respondieron, recuerdos, el clima) para que sea personal, y di brevemente por qué encaja con ellos.
${conBusqueda
    ? '- Lo que sabes de memoria puede estar viejo. Para todo lo que cambia con el tiempo (eventos, conciertos, estrenos, cartelera, horarios, precios, si un lugar sigue abierto, noticias) busca en internet antes de responder, aunque creas saberlo. Busca con el año actual en la consulta (por ejemplo "tarifas Jardín Botánico Bogotá ${hoyBogota().slice(0, 4)}") y prefiere la página oficial. Fíjate en la fecha de cada página: tarifas, precios o carteleras de años o temporadas anteriores no sirven; si solo encuentras datos viejos, dilo con su año. Da la fecha exacta de los eventos y menciona la fuente (el nombre del sitio). Si no encuentras nada confiable, dilo; no lo completes de memoria.'
    : '- No puedes buscar en internet: si te piden eventos, horarios o precios de hoy, dilo con honestidad y sugiere dónde mirarlos; no inventes fechas ni precios.'}
- Siempre que propongas algo concreto (una cita, un plan, una peli, una carta, un cupón), llama la herramienta sugerir_accion antes de terminar tu respuesta para dejarle el botón; por ejemplo, al armar una cita, una acción planear_cita con el nombre corto del plan. El botón solo aparece si llamas la herramienta: nunca escribas las acciones en el texto, ni en JSON, ni como una lista de "acciones rápidas".
- Guarda los secretos: no reveles a dónde es una cita sorpresa ni qué regalo le están preparando a la otra persona. Si ${miNombre} te pide ayuda con una sorpresa para ${pareja}, ayúdale con gusto.
- Si no sabes algo de ellos, dilo y pregunta; no inventes recuerdos ni datos.`;

  // La historia va de la más vieja a la más nueva, terminando en lo que acaba de preguntar
  const historia: Turno[] = ((previos ?? []) as Turno[]).reverse();
  while (historia.length && historia[0].rol !== 'user') historia.shift();
  if (historia[historia.length - 1]?.contenido !== texto) historia.push({ rol: 'user', contenido: texto });

  const acciones: Accion[] = [];
  const herramienta: Herramienta = (nombre, input) => ejecutar(db, user.id, esAdmin, nombre, input).catch(() => 'No pude leer eso ahora.');
  const limite = inicio + 55_000;
  // En orden de preferencia; si uno falla (sin saldo, sin cuota, caído) se pasa al siguiente
  const proveedores: [string, () => Promise<Resultado>][] = [];
  if (ANTHROPIC_API_KEY) proveedores.push(['claude', () => conClaude(ANTHROPIC_API_KEY, armarSistema(true), historia, acciones, herramienta)]);
  if (clavesGroq.length) proveedores.push(['groq', () => conGroq(clavesGroq, armarSistema(true), historia, acciones, herramienta, limite)]);
  if (clavesGemini.length) proveedores.push(['gemini', () => conGemini(clavesGemini, armarSistema(false), historia, acciones, herramienta, limite)]);

  let resultado: Resultado | null = null;
  let codigo: ErrorAsistente['codigo'] = 'fallo';
  for (const [nombre, pedirle] of proveedores) {
    if (limite - Date.now() < 8000) break;
    acciones.length = 0; // los botones de un intento que falló no cuentan
    try {
      resultado = await pedirle();
      break;
    } catch (e) {
      codigo = e instanceof ErrorAsistente ? e.codigo : 'fallo';
      console.warn('asistente: falló', nombre, codigo, e instanceof ErrorAsistente ? '' : e);
    }
  }
  if (!resultado) return json({ error: codigo }, codigo === 'fallo' ? 502 : 503);
  resultado.texto = sinTablas(quitarBotonesEscritos(rescatarAcciones(resultado.texto, acciones)));

  let salida = resultado.rechazo ? 'Uy, con eso no te puedo ayudar 🐋 ¿Probamos con otra cosa?' : resultado.texto;
  if (!salida) salida = acciones.length ? 'Te dejé unas ideas aquí abajo 💚' : 'Me quedé pensando y no encontré qué decir 🐋 ¿Me lo preguntas de otra forma?';

  const [{ data: guardado }] = await Promise.all([
    db.from('asistente_mensajes').insert({ conversacion_id: conversacionId, rol: 'assistant', contenido: salida.slice(0, 12000), acciones }).select('id, created_at').single(),
    db.from('asistente_conversaciones').update({ updated_at: new Date().toISOString() }).eq('id', conversacionId),
  ]);
  return json({ id: guardado?.id, conversacion: conversacionId, texto: salida, acciones });
}
