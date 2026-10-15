// Función de Vercel: el asistente de la app (Payakan). Usa Claude si hay ANTHROPIC_API_KEY;
// si no, Gemini con GEMINI_API_KEY (gratis, una o varias claves separadas por comas).
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

export async function ejecutar(db: SupabaseClient, yo: string, esAdmin: boolean, nombre: string, input: any): Promise<string> {
  const hoy = hoyBogota();
  switch (nombre) {
    case 'ver_citas': {
      const q = db.from('citas').select('fecha, estado, es_cita_sorpresa, hora_confirmada, lugar_personalizado, creada_por, lugares(nombre, zona), actividades(nombre), franjas(nombre)');
      const { data } = input.cuales === 'pasadas'
        ? await q.eq('estado', 'vivida').order('fecha', { ascending: false }).limit(25)
        : await q.in('estado', ['pendiente', 'confirmada']).gte('fecha', hoy).order('fecha').limit(15);
      // Si es sorpresa, solo quien tiene el permiso de admin sabe a dónde van
      return JSON.stringify((data ?? []).map((c: any) => {
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
      const filas = (data ?? []).map((r: any) => ({ pregunta: r.preguntas?.texto, quien: r.usuario_id === yo ? 'tú' : 'tu pareja', respuesta: r.texto }))
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
      return JSON.stringify({
        planes_por_cumplir: (planes.data ?? []).map((p: any) => p.titulo),
        pelis_por_ver: pelis.data ?? [],
        reto_del_mes: (reto.data as any)?.[0] ? { reto: (reto.data as any)[0].texto, cumplido: !!(reto.data as any)[0].cumplido_en } : null,
        animo_ultimos_dias: (animo.data ?? []).map((a: any) => ({ quien: a.usuario_id === yo ? 'tú' : 'tu pareja', fecha: a.fecha, como: a.etiqueta })),
      });
    }
    case 'ver_clima': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) return 'Fecha inválida';
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
type Herramienta = (nombre: string, input: any) => Promise<string>;
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

/* ---------- Con Claude (si hay ANTHROPIC_API_KEY) ---------- */
async function conClaude(clave: string, sistema: string, historia: Turno[], acciones: Accion[], herramienta: Herramienta): Promise<Resultado> {
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
        tools: HERRAMIENTAS,
        messages: mensajes,
      });
      if (respuesta.stop_reason === 'pause_turn') { mensajes.push({ role: 'assistant', content: respuesta.content }); continue; }
      if (respuesta.stop_reason !== 'tool_use') break;

      mensajes.push({ role: 'assistant', content: respuesta.content });
      const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const b of respuesta.content) {
        if (b.type !== 'tool_use') continue;
        const content = b.name === 'sugerir_accion' ? anotarAccion(acciones, b.input as Accion) : await herramienta(b.name, b.input);
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

/* ---------- Con Gemini (gratis; si no hay clave de Anthropic) ---------- */
// En orden: si uno está saturado o se acabó su cuota, se prueba el siguiente
const MODELOS_GEMINI = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];

// Gemini usa un subconjunto de JSON Schema: sin additionalProperties ni strict
function esquemaGemini(s: any): any {
  if (!s || typeof s !== 'object') return s;
  const { additionalProperties: _a, ...resto } = s;
  if (resto.properties) resto.properties = Object.fromEntries(Object.entries(resto.properties).map(([k, v]) => [k, esquemaGemini(v)]));
  return resto;
}
const FUNCIONES_GEMINI = HERRAMIENTAS
  .filter((h): h is Anthropic.Beta.BetaTool => 'input_schema' in h)
  .map((h) => ({
    name: h.name,
    description: h.description,
    // Sin propiedades, Gemini prefiere que no vaya el esquema
    ...(Object.keys((h.input_schema as any).properties ?? {}).length ? { parameters: esquemaGemini(h.input_schema) } : {}),
  }));

// Lo que se va aprendiendo durante una misma pregunta, para no repetir intentos que ya fallaron
export type MemoriaGemini = {
  agotadas: Set<string>; // "modelo|clave" sin cuota (la cuota gratis es por modelo)
  clavesMalas: Set<string>; // clave inválida o sin permiso: no sirve con ningún modelo
  modelosCaidos: Set<string>; // saturado, no existe o no contestó a tiempo
  buena?: { modelo: string; clave: string }; // la última que respondió: se prueba primero
};
export const memoriaNueva = (): MemoriaGemini => ({ agotadas: new Set(), clavesMalas: new Set(), modelosCaidos: new Set() });

export async function pedirGemini(claves: string[], cuerpo: unknown, limite: number, memoria: MemoriaGemini, pedir: typeof fetch = fetch): Promise<any> {
  const intentos = MODELOS_GEMINI.flatMap((modelo) => claves.map((clave) => ({ modelo, clave })));
  if (memoria.buena) intentos.unshift(memoria.buena);
  const probados = new Set<string>();
  for (const { modelo, clave } of intentos) {
    const par = `${modelo}|${clave}`;
    if (probados.has(par) || memoria.agotadas.has(par) || memoria.clavesMalas.has(clave) || memoria.modelosCaidos.has(modelo)) continue;
    probados.add(par);
    const queda = limite - Date.now();
    if (queda < 4000) break;
    try {
      const r = await pedir(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(Math.min(20_000, queda - 2000)),
      });
      if (r.ok) { memoria.buena = { modelo, clave }; return await r.json(); }
      console.warn('gemini', modelo, r.status);
      if (memoria.buena?.modelo === modelo && memoria.buena.clave === clave) memoria.buena = undefined;
      if (r.status === 429) memoria.agotadas.add(par);
      else if (r.status === 401 || r.status === 403) memoria.clavesMalas.add(clave);
      else if (r.status === 404 || r.status >= 500) memoria.modelosCaidos.add(modelo);
      else { console.error('gemini', modelo, r.status, (await r.text()).slice(0, 300)); throw new ErrorAsistente('fallo'); }
    } catch (e) {
      if (e instanceof ErrorAsistente) throw e;
      // No contestó a tiempo: ese modelo está lento, se pasa al siguiente
      console.warn('gemini', modelo, 'sin respuesta a tiempo');
      memoria.modelosCaidos.add(modelo);
    }
  }
  throw new ErrorAsistente('ocupado');
}

async function conGemini(claves: string[], sistema: string, historia: Turno[], acciones: Accion[], herramienta: Herramienta, limite: number): Promise<Resultado> {
  const contents: any[] = historia.map((m) => ({ role: m.rol === 'assistant' ? 'model' : 'user', parts: [{ text: m.contenido }] }));
  const memoria = memoriaNueva();
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const r = await pedirGemini(claves, {
      systemInstruction: { parts: [{ text: sistema }] },
      contents,
      tools: [{ functionDeclarations: FUNCIONES_GEMINI }],
      generationConfig: { maxOutputTokens: 4000 },
    }, limite, memoria);
    const candidato = r.candidates?.[0];
    if (!candidato || ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'].includes(candidato.finishReason)) return { texto: '', rechazo: true };
    const partes: any[] = candidato.content?.parts ?? [];
    const llamadas = partes.filter((p) => p.functionCall);
    if (!llamadas.length) return { texto: partes.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim(), rechazo: false };

    // Las partes vuelven tal cual (con su thoughtSignature): Gemini las necesita para seguir
    contents.push({ role: 'model', parts: partes });
    const respuestas = [];
    for (const p of llamadas) {
      const { name, args } = p.functionCall;
      const resultado = name === 'sugerir_accion' ? anotarAccion(acciones, args as Accion) : await herramienta(name, args ?? {});
      respuestas.push({ functionResponse: { name, response: { resultado } } });
    }
    contents.push({ role: 'user', parts: respuestas });
  }
  return { texto: '', rechazo: false };
}

/* ---------- La petición ---------- */
export async function POST(request: Request) {
  const inicio = Date.now();
  const { ANTHROPIC_API_KEY, GEMINI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env;
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) return json({ error: 'config' }, 500);
  // Primero Claude (de pago); si no hay, Gemini (gratis). GEMINI_API_KEY acepta varias claves separadas por comas.
  const clavesGemini = (GEMINI_API_KEY ?? '').split(',').map((c) => c.trim()).filter(Boolean);

  // Solo con sesión de la app
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'sin_sesion' }, 401);
  const db = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return json({ error: 'sin_sesion' }, 401);
  if (!ANTHROPIC_API_KEY && !clavesGemini.length) return json({ error: 'sin_clave' }, 503);

  const { mensaje } = (await request.json().catch(() => ({}))) as { mensaje?: string };
  const texto = String(mensaje ?? '').trim().slice(0, 2000);
  if (!texto) return json({ error: 'vacio' }, 400);

  const { data: llevaHoy } = await db.rpc('preguntas_al_asistente_hoy');
  if ((llevaHoy ?? 0) >= TOPE_DIARIO) return json({ error: 'tope' }, 429);

  const [{ data: cfg }, { data: perfiles }, { data: permiso }, { data: previos }] = await Promise.all([
    db.from('configuracion').select('nombre_el, nombre_ella, apodo_ella, fecha_inicio, cumple_el, cumple_ella').eq('id', 1).single(),
    db.from('perfiles').select('id, nombre, rol'),
    db.from('permisos').select('es_admin').eq('usuario_id', user.id).maybeSingle(),
    db.from('asistente_mensajes').select('rol, contenido').order('created_at', { ascending: false }).limit(HISTORIA),
  ]);
  const yo = (perfiles ?? []).find((p: any) => p.id === user.id);
  const soyEl = yo?.rol === 'admin';
  const miNombre = (soyEl ? cfg?.nombre_el : cfg?.nombre_ella) ?? yo?.nombre ?? '';
  const pareja = (soyEl ? cfg?.nombre_ella : cfg?.nombre_el) ?? 'tu pareja';
  const esAdmin = !!permiso?.es_admin;
  const conBusqueda = !!ANTHROPIC_API_KEY;

  await db.from('asistente_mensajes').insert({ rol: 'user', contenido: texto });

  // El sistema no cambia entre preguntas del mismo día: así se aprovecha el caché
  const sistema = `Eres Payakan, el asistente de You and me (tu nombre es el del tulkun de Avatar: a ${cfg?.nombre_ella ?? 'ella'} le encantan las ballenas). You and me es la app privada de ${cfg?.nombre_el ?? 'él'} y ${cfg?.nombre_ella ?? 'ella'}, una pareja que vive en Bogotá. Están juntos desde el ${cfg?.fecha_inicio ?? '(sin fecha)'}. Cumpleaños: ${cfg?.nombre_el} el ${cfg?.cumple_el ?? '?'}, ${cfg?.nombre_ella} el ${cfg?.cumple_ella ?? '?'}. A ${cfg?.nombre_ella} le dicen "${cfg?.apodo_ella ?? 'Ma vie'}" y le encantan las ballenas azules.
Hoy es ${hoyBogota()} (hora de Bogotá). Hablas con ${miNombre}; su pareja es ${pareja}.

Cómo responder:
- Español de Colombia, cálido, cercano y breve: lo leen en el celular. Párrafos cortos o listas cortas, sin títulos grandes.
- Ayudas a planear citas y sorpresas, a elegir regalos, a escribir cartas o mensajes, a recordar lo que han vivido y a cuidar la relación.
- No toman alcohol: nunca propongas bares, vino, cócteles ni planes alrededor de tragos. Salen en Bogotá; no propongas pueblos ni viajes fuera salvo que te lo pidan.
- Antes de recomendar, mira sus datos con las herramientas (lugares por conocer, lo que respondieron, recuerdos, el clima) para que sea personal, y di brevemente por qué encaja con ellos.
${conBusqueda
    ? '- Para eventos, horarios o precios actuales en Bogotá usa la búsqueda web y menciona la fuente.'
    : '- No puedes buscar en internet: si te piden eventos, horarios o precios de hoy, dilo con honestidad y sugiere dónde mirarlos; no inventes fechas ni precios.'}
- Siempre que propongas algo concreto (una cita, un plan, una peli, una carta, un cupón), llama sugerir_accion antes de terminar tu respuesta para dejarle el botón; por ejemplo, al armar una cita, una acción planear_cita con el nombre corto del plan.
- Guarda los secretos: no reveles a dónde es una cita sorpresa ni qué regalo le están preparando a la otra persona. Si ${miNombre} te pide ayuda con una sorpresa para ${pareja}, ayúdale con gusto.
- Si no sabes algo de ellos, dilo y pregunta; no inventes recuerdos ni datos.`;

  // La historia va de la más vieja a la más nueva, terminando en lo que acaba de preguntar
  const historia: Turno[] = ((previos ?? []) as Turno[]).reverse();
  while (historia.length && historia[0].rol !== 'user') historia.shift();
  if (historia[historia.length - 1]?.contenido !== texto) historia.push({ rol: 'user', contenido: texto });

  const acciones: Accion[] = [];
  const herramienta: Herramienta = (nombre, input) => ejecutar(db, user.id, esAdmin, nombre, input).catch(() => 'No pude leer eso ahora.');
  let resultado: Resultado;
  try {
    resultado = ANTHROPIC_API_KEY
      ? await conClaude(ANTHROPIC_API_KEY, sistema, historia, acciones, herramienta)
      : await conGemini(clavesGemini, sistema, historia, acciones, herramienta, inicio + 55_000);
  } catch (e) {
    const codigo = e instanceof ErrorAsistente ? e.codigo : 'fallo';
    if (!(e instanceof ErrorAsistente)) console.error('asistente', e);
    return json({ error: codigo }, codigo === 'fallo' ? 502 : 503);
  }

  let salida = resultado.rechazo ? 'Uy, con eso no te puedo ayudar 🐋 ¿Probamos con otra cosa?' : resultado.texto;
  if (!salida) salida = acciones.length ? 'Te dejé unas ideas aquí abajo 💚' : 'Me quedé pensando y no encontré qué decir 🐋 ¿Me lo preguntas de otra forma?';

  const { data: guardado } = await db.from('asistente_mensajes').insert({ rol: 'assistant', contenido: salida.slice(0, 12000), acciones }).select('id, created_at').single();
  return json({ id: guardado?.id, texto: salida, acciones });
}
