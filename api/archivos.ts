// Función de Vercel: fotos, videos y audios en un almacenamiento externo compatible con S3
// (Cloudflare R2 recomendado; también el bucket de Firebase/Google Cloud con llaves HMAC, Backblaze o AWS).
// Quién puede ver, subir o borrar cada archivo lo deciden las reglas de la base (archivos_externos, migración 038):
// aquí solo se firman enlaces cortos de lo que esas reglas dejan ver a quien pregunta.
//
// Variables en Vercel: S3_ENDPOINT (p. ej. https://<cuenta>.r2.cloudflarestorage.com), S3_BUCKET, S3_ACCESS_KEY_ID,
// S3_SECRET_ACCESS_KEY, S3_REGION (opcional, "auto" en R2) y SUPABASE_SERVICE_ROLE_KEY (solo para migrar).
import { AwsClient } from 'aws4fetch';
import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const maxDuration = 60;

type Bucket = 'recuerdos' | 'adjuntos';
const BUCKETS: Bucket[] = ['recuerdos', 'adjuntos'];
const MAX_BYTES: Record<Bucket, number> = { recuerdos: 50 * 1024 * 1024, adjuntos: 15 * 1024 * 1024 };

const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status });
const esBucket = (b: unknown): b is Bucket => BUCKETS.includes(b as Bucket);
export const rutaValida = (r: unknown): r is string =>
  typeof r === 'string' && r.length >= 3 && r.length <= 512 && /^[\w\-./]+$/.test(r) && !r.split('/').some((p) => p === '' || p === '.' || p === '..');

// La llave dentro del almacenamiento externo: un solo bucket con una carpeta por cada bucket de Supabase
export const llaveExterna = (bucket: Bucket, ruta: string) => `${bucket}/${ruta}`.split('/').map(encodeURIComponent).join('/');

function almacen() {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION } = process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  const s3 = new AwsClient({ accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY, service: 's3', region: S3_REGION || 'auto' });
  const base = `${S3_ENDPOINT.replace(/\/+$/, '')}/${encodeURIComponent(S3_BUCKET)}`;
  const url = (bucket: Bucket, ruta: string) => `${base}/${llaveExterna(bucket, ruta)}`;
  return {
    async firmar(metodo: 'GET' | 'PUT', bucket: Bucket, ruta: string, segundos: number) {
      const r = await s3.sign(new Request(`${url(bucket, ruta)}?X-Amz-Expires=${segundos}`, { method: metodo }), { aws: { signQuery: true } });
      return r.url;
    },
    poner: (bucket: Bucket, ruta: string, cuerpo: ArrayBuffer, tipo?: string) =>
      s3.fetch(url(bucket, ruta), { method: 'PUT', body: cuerpo, headers: tipo ? { 'Content-Type': tipo } : {} }),
    async tamano(bucket: Bucket, ruta: string): Promise<number | null> {
      const r = await s3.fetch(url(bucket, ruta), { method: 'HEAD' });
      return r.ok ? Number(r.headers.get('content-length')) : null;
    },
    quitar: (bucket: Bucket, ruta: string) => s3.fetch(url(bucket, ruta), { method: 'DELETE' }),
    // El navegador sube y baja directo con enlaces firmados: el bucket tiene que aceptar pedidos de otra página.
    // Los enlaces firmados son la protección, así que el origen puede ser cualquiera
    async permitirNavegador() {
      const xml = '<CORSConfiguration><CORSRule><AllowedOrigin>*</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedMethod>HEAD</AllowedMethod>'
        + '<AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><ExposeHeader>Content-Length</ExposeHeader><MaxAgeSeconds>86400</MaxAgeSeconds></CORSRule></CORSConfiguration>';
      return s3.fetch(`${base}?cors`, { method: 'PUT', body: xml, headers: { 'Content-Type': 'application/xml', 'Content-MD5': createHash('md5').update(xml).digest('base64') } });
    },
  };
}
type Almacen = NonNullable<ReturnType<typeof almacen>>;

/* ---------- Lo de todos los días ---------- */
async function firmar(db: SupabaseClient, ext: Almacen | null, bucket: Bucket, rutas: string[], segundos: number) {
  const salida: Record<string, string> = {};
  // Lo que ya está afuera y estas reglas dejan ver (RLS con la sesión de quien pregunta)
  const afuera = new Set<string>();
  if (ext) {
    const { data } = await db.from('archivos_externos').select('ruta').eq('bucket', bucket).in('ruta', rutas);
    for (const f of data ?? []) afuera.add(f.ruta);
    await Promise.all([...afuera].map(async (r) => { salida[r] = await ext.firmar('GET', bucket, r, segundos); }));
  }
  // Lo que sigue en Supabase (durante la migración, o si nunca se movió)
  const adentro = rutas.filter((r) => !afuera.has(r));
  if (adentro.length) {
    const { data } = await db.storage.from(bucket).createSignedUrls(adentro, segundos);
    for (const d of data ?? []) if (d.signedUrl && d.path) salida[d.path] = d.signedUrl;
  }
  return salida;
}

async function subir(db: SupabaseClient, ext: Almacen, uid: string, bucket: Bucket, ruta: string, tipo: string, bytes: number) {
  if (!(bytes > 0) || bytes > MAX_BYTES[bucket]) return json({ error: 'muy_grande' }, 413);
  // La regla de la base decide si puede subir aquí (la misma carpeta permitida que en Supabase)
  const { error } = await db.from('archivos_externos').insert({ bucket, ruta, owner: uid, bytes, tipo: tipo.slice(0, 100) || null });
  if (error) return json({ error: error.code === '23505' ? 'ya_existe' : 'sin_permiso' }, 403);
  return json({ url: await ext.firmar('PUT', bucket, ruta, 900) });
}

async function borrar(db: SupabaseClient, ext: Almacen | null, bucket: Bucket, rutas: string[]) {
  const borradas = new Set<string>();
  if (ext) {
    // Solo se borran las filas que la regla deja borrar; esas mismas se quitan del almacenamiento
    const { data } = await db.from('archivos_externos').delete().eq('bucket', bucket).in('ruta', rutas).select('ruta');
    await Promise.all((data ?? []).map(async (f) => { await ext.quitar(bucket, f.ruta); borradas.add(f.ruta); }));
  }
  // Y la copia de Supabase, si todavía existe
  const { data } = await db.storage.from(bucket).remove(rutas);
  for (const o of data ?? []) borradas.add(o.name);
  return json({ borradas: [...borradas] });
}

/* ---------- La migración (solo el admin) ---------- */
async function migrar(servicio: SupabaseClient, ext: Almacen, saltar: string[], limite: number) {
  await servicio.from('configuracion').update({ archivos_en: 'externo' }).eq('id', 1);
  const omitir = new Set(saltar);
  const fallidos: string[] = [];
  let movidos = 0;
  while (Date.now() < limite) {
    const { data, error } = await servicio.rpc('archivos_por_mover', { p_limite: 10 + omitir.size });
    if (error) throw error;
    const lista = ((data ?? []) as { bucket: Bucket; ruta: string; owner: string | null; bytes: number | null; tipo: string | null }[])
      .filter((f) => !omitir.has(`${f.bucket}/${f.ruta}`));
    if (!lista.length) break;
    for (const f of lista) {
      if (Date.now() >= limite) break;
      const clave = `${f.bucket}/${f.ruta}`;
      try {
        const { data: blob, error: e1 } = await servicio.storage.from(f.bucket).download(f.ruta);
        if (e1 || !blob) throw e1 ?? new Error('vacío');
        const cuerpo = await blob.arrayBuffer();
        const puesto = await ext.poner(f.bucket, f.ruta, cuerpo, f.tipo ?? blob.type ?? undefined);
        if (!puesto.ok) throw new Error(`PUT ${puesto.status}`);
        // Solo cuenta como movido si el almacenamiento confirma el mismo tamaño
        if ((await ext.tamano(f.bucket, f.ruta)) !== cuerpo.byteLength) throw new Error('tamaño distinto');
        const { error: e2 } = await servicio.from('archivos_externos').upsert({ bucket: f.bucket, ruta: f.ruta, owner: f.owner, bytes: cuerpo.byteLength, tipo: f.tipo ?? blob.type ?? null });
        if (e2) throw e2;
        movidos++;
      } catch (e) {
        console.warn('archivos: no pude mover', clave, e);
        omitir.add(clave);
        fallidos.push(clave);
      }
    }
  }
  const { data: estado } = await servicio.rpc('estado_migracion');
  return json({ movidos, fallidos, estado });
}

// Borra de Supabase lo que ya está afuera, revisando antes que de verdad esté allá completo
async function liberar(servicio: SupabaseClient, ext: Almacen, limite: number) {
  let liberados = 0;
  const dudosos: string[] = [];
  while (Date.now() < limite) {
    const { data, error } = await servicio.rpc('archivos_por_liberar', { p_limite: 50 });
    if (error) throw error;
    const lista = ((data ?? []) as { bucket: Bucket; ruta: string }[]).filter((f) => !dudosos.includes(`${f.bucket}/${f.ruta}`));
    if (!lista.length) break;
    const { data: filas } = await servicio.from('archivos_externos').select('bucket, ruta, bytes').in('ruta', lista.map((f) => f.ruta));
    const esperado = new Map((filas ?? []).map((f: any) => [`${f.bucket}/${f.ruta}`, Number(f.bytes)]));
    for (const b of BUCKETS) {
      const listos: string[] = [];
      for (const f of lista.filter((x) => x.bucket === b)) {
        if (Date.now() >= limite) break;
        const t = await ext.tamano(b, f.ruta);
        if (t != null && t === esperado.get(`${b}/${f.ruta}`)) listos.push(f.ruta);
        else dudosos.push(`${b}/${f.ruta}`);
      }
      if (listos.length) {
        const { data: quitados } = await servicio.storage.from(b).remove(listos);
        liberados += quitados?.length ?? 0;
      }
    }
  }
  const { data: estado } = await servicio.rpc('estado_migracion');
  return json({ liberados, dudosos, estado });
}

/* ---------- La petición ---------- */
export async function POST(request: Request) {
  const inicio = Date.now();
  const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) return json({ error: 'config' }, 500);
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'sin_sesion' }, 401);
  const db = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return json({ error: 'sin_sesion' }, 401);

  const cuerpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const accion = cuerpo.accion;
  const ext = almacen();
  const bucket = cuerpo.bucket;
  const rutas = Array.isArray(cuerpo.rutas) ? (cuerpo.rutas as unknown[]).filter(rutaValida).slice(0, 200) : [];

  try {
    switch (accion) {
      case 'firmar': {
        if (!esBucket(bucket)) return json({ error: 'pedido' }, 400);
        const segundos = Math.min(86400, Math.max(60, Number(cuerpo.segundos) || 3600));
        return json({ urls: await firmar(db, ext, bucket, rutas, segundos) });
      }
      case 'subir': {
        if (!ext) return json({ error: 'sin_almacen' }, 503);
        if (!esBucket(bucket) || !rutaValida(cuerpo.ruta)) return json({ error: 'pedido' }, 400);
        return await subir(db, ext, user.id, bucket, cuerpo.ruta, String(cuerpo.tipo ?? ''), Number(cuerpo.bytes));
      }
      case 'borrar': {
        if (!esBucket(bucket)) return json({ error: 'pedido' }, 400);
        return await borrar(db, ext, bucket, rutas);
      }
    }

    // Lo que sigue es solo para el admin
    const { data: admin } = await db.rpc('es_admin');
    if (!admin) return json({ error: 'sin_permiso' }, 403);
    const servicio = SUPABASE_SERVICE_ROLE_KEY
      ? createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
    switch (accion) {
      case 'estado': {
        const { data: estado } = servicio ? await servicio.rpc('estado_migracion') : { data: null };
        return json({ almacen: !!ext, servicio: !!servicio, estado });
      }
      case 'probar': {
        if (!ext) return json({ error: 'sin_almacen' }, 503);
        const cors = await ext.permitirNavegador();
        const prueba = new TextEncoder().encode(`prueba ${new Date().toISOString()}`);
        const puesto = await ext.poner('adjuntos', '_prueba/conexion.txt', prueba.buffer as ArrayBuffer, 'text/plain');
        const tam = puesto.ok ? await ext.tamano('adjuntos', '_prueba/conexion.txt') : null;
        if (puesto.ok) await ext.quitar('adjuntos', '_prueba/conexion.txt');
        const ok = puesto.ok && tam === prueba.byteLength;
        return json({ ok, cors: cors.ok, detalle: ok ? '' : `No pude escribir en el almacenamiento (respuesta ${puesto.status}). Revisa el endpoint, el bucket y las llaves.` });
      }
      case 'migrar': {
        if (!ext) return json({ error: 'sin_almacen' }, 503);
        if (!servicio) return json({ error: 'sin_servicio' }, 503);
        const saltar = Array.isArray(cuerpo.saltar) ? (cuerpo.saltar as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 500) : [];
        return await migrar(servicio, ext, saltar, inicio + 45_000);
      }
      case 'liberar': {
        if (!ext) return json({ error: 'sin_almacen' }, 503);
        if (!servicio) return json({ error: 'sin_servicio' }, 503);
        return await liberar(servicio, ext, inicio + 45_000);
      }
    }
    return json({ error: 'pedido' }, 400);
  } catch (e) {
    console.error('archivos:', accion, e);
    return json({ error: 'fallo' }, 500);
  }
}
