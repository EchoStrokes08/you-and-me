// Copia automática: guarda en una carpeta de este computador todo lo que vive en Supabase.
//   datos/AAAA-MM-DD.json   todas las tablas tal cual, más las cuentas y la lista de archivos
//   archivos/<bucket>/…     fotos, videos y audios; solo se descargan los nuevos
// Nunca borra un archivo ya copiado: si algo se borra por error en la app, aquí sigue.
// A diferencia de "Descargar copia" de la app, incluye también lo que aún es secreto
// (cartas sin abrir, cápsulas cerradas, regalos): la carpeta no es para mirarla, es para restaurar.
// Uso: npm run copia            (la carpeta sale de COPIA_DESTINO o es "Copias You and me" en tu usuario)
//      npm run copia:programar  (una vez: la deja corriendo sola cada semana)
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Cuántos datos/*.json se conservan (uno por día que corre: con la copia semanal, más de medio año)
const COPIAS_DE_DATOS = 30;

const { DATABASE_URL, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DATABASE_URL) {
  console.error('Falta DATABASE_URL en .env');
  process.exit(1);
}
const destino = path.resolve(process.env.COPIA_DESTINO || path.join(os.homedir(), 'Copias You and me'));
const dirDatos = path.join(destino, 'datos');
const dirArchivos = path.join(destino, 'archivos');
fs.mkdirSync(dirDatos, { recursive: true });
fs.mkdirSync(dirArchivos, { recursive: true });

const hoy = new Date();
const dia = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
const registrar = (texto) => fs.appendFileSync(path.join(destino, 'registro.txt'), `${hoy.toISOString()}  ${texto}\n`);

const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
let fallas = 0;
try {
  await c.connect();

  // Todo se lee en una sola foto de la base, para que las tablas queden coherentes entre sí
  await c.query('begin transaction isolation level repeatable read read only');
  const { rows: nombres } = await c.query("select tablename from pg_tables where schemaname = 'public' order by tablename");
  const tablas = {};
  for (const { tablename } of nombres) {
    const { rows } = await c.query(`select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as filas from public.${c.escapeIdentifier(tablename)} t`);
    tablas[tablename] = rows[0].filas;
  }
  const { rows: usuarios } = await c.query('select id, email from auth.users order by created_at');
  const { rows: archivos } = await c.query("select bucket_id as bucket, name as ruta, owner_id as duenio, (metadata->>'size')::bigint::float8 as tam, metadata->>'mimetype' as tipo from storage.objects order by bucket_id, name");
  await c.query('commit');

  // Primero a un temporal: si se corta la luz a la mitad, no queda un archivo a medias con nombre bueno
  const archivoDatos = path.join(dirDatos, `${dia}.json`);
  fs.writeFileSync(archivoDatos + '.tmp', JSON.stringify({ generado: hoy.toISOString(), usuarios, archivos, tablas }));
  fs.renameSync(archivoDatos + '.tmp', archivoDatos);
  const filas = Object.values(tablas).reduce((n, t) => n + t.length, 0);
  console.log(`Datos: ${Object.keys(tablas).length} tablas, ${filas} filas → ${archivoDatos}`);

  // Fotos, videos y audios
  let nuevos = 0, yaEstaban = 0;
  const conArchivos = !!(VITE_SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
  if (!conArchivos) {
    fallas++;
    console.error('\n⚠ No copié las fotos ni los audios: falta SUPABASE_SERVICE_ROLE_KEY en .env.\n  Está en Supabase → Project Settings → API Keys (la "secret key"). Va solo en tu .env local.');
  } else {
    const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const cola = [...archivos];
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (let a = cola.shift(); a; a = cola.shift()) {
        const local = path.resolve(dirArchivos, a.bucket, a.ruta);
        if (!local.startsWith(dirArchivos + path.sep)) { fallas++; console.error(`  ✗ ruta rara, no la copio: ${a.bucket}/${a.ruta}`); continue; }
        if (fs.existsSync(local) && fs.statSync(local).size === a.tam) { yaEstaban++; continue; }
        try {
          const { data, error } = await supabase.storage.from(a.bucket).download(a.ruta);
          if (error) throw error;
          fs.mkdirSync(path.dirname(local), { recursive: true });
          fs.writeFileSync(local + '.tmp', Buffer.from(await data.arrayBuffer()));
          fs.renameSync(local + '.tmp', local);
          nuevos++;
        } catch (e) {
          fallas++;
          console.error(`  ✗ ${a.bucket}/${a.ruta}: ${e.message ?? e}`);
        }
      }
    }));
    console.log(`Archivos: ${nuevos} nuevos, ${yaEstaban} ya estaban${fallas ? `, ${fallas} con error` : ''} → ${dirArchivos}`);
  }

  // Solo se conservan las copias de datos más recientes (los archivos no se tocan)
  const viejas = fs.readdirSync(dirDatos).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(0, -COPIAS_DE_DATOS);
  for (const f of viejas) fs.rmSync(path.join(dirDatos, f));

  fs.writeFileSync(path.join(destino, 'LEEME.txt'), [
    'Copia de seguridad de You and me 💚',
    '',
    'datos/     una foto de toda la base por cada día que corrió la copia (la más nueva es la que sirve).',
    'archivos/  las fotos, los videos y los audios, en las mismas carpetas que tienen en Supabase.',
    'registro.txt  cuándo corrió y cómo le fue.',
    '',
    'Incluye cartas sin abrir, cápsulas cerradas y regalos: no es para leerla, es para restaurar.',
    'Para revisar que una copia sirve, desde la carpeta del proyecto:  npm run restaurar -- "esta carpeta"',
    'Para restaurar de verdad en un proyecto nuevo de Supabase, mira "Copia automática" en el README.',
    '',
  ].join('\r\n'));

  // La app le recuerda al admin cuando lleva 30 días sin copia: una copia completa cuenta
  if (!fallas) await c.query('update public.configuracion set ultima_copia = now() where id = 1');
  registrar(fallas ? `INCOMPLETA: ${filas} filas, ${nuevos} archivos nuevos, ${fallas} ${conArchivos ? 'archivos con error' : '(sin fotos ni audios: falta SUPABASE_SERVICE_ROLE_KEY)'}` : `OK: ${filas} filas, ${nuevos} archivos nuevos, ${yaEstaban} ya estaban`);
  console.log(fallas ? '\nLa copia quedó INCOMPLETA.' : '\nCopia completa ✓');
} catch (e) {
  fallas++;
  registrar(`ERROR: ${e.message}`);
  console.error('ERROR:', e.message);
} finally {
  await c.end().catch(() => {});
}
process.exit(fallas ? 1 : 0);
