// Restaura una copia hecha con `npm run copia`.
//
//   npm run restaurar -- "C:\…\Copias You and me"
//       PRUEBA (lo normal): revisa que la copia se puede volver a cargar. Mete los datos en tablas
//       temporales, los compara con la base y deshace todo. No guarda nada.
//
//   npm run restaurar -- "C:\…\Copias You and me" --de-verdad
//       Restaura en la base de DATABASE_URL. Solo en un proyecto NUEVO de Supabase: con las
//       migraciones aplicadas, las dos cuentas creadas con los mismos correos y sin datos nuestros.
//       Si encuentra recuerdos, citas, respuestas o cartas, no hace nada.
//
// Otra copia que no sea la más reciente: --datos 2026-10-13
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const deVerdad = args.includes('--de-verdad');
const iDatos = args.indexOf('--datos');
const carpeta = args.find((a, i) => !a.startsWith('--') && (iDatos < 0 || i !== iDatos + 1));
const { DATABASE_URL, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DATABASE_URL || !carpeta) {
  console.error(!DATABASE_URL ? 'Falta DATABASE_URL en .env' : 'Uso: npm run restaurar -- "carpeta de la copia" [--datos AAAA-MM-DD] [--de-verdad]');
  process.exit(1);
}

const dirDatos = path.join(carpeta, 'datos');
const dirArchivos = path.resolve(carpeta, 'archivos');
const copias = fs.existsSync(dirDatos) ? fs.readdirSync(dirDatos).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];
const elegida = iDatos >= 0 ? `${args[iDatos + 1]}.json` : copias.at(-1);
if (!elegida || !copias.includes(elegida)) {
  console.error(`No encontré ${iDatos >= 0 ? elegida : 'ninguna copia'} en ${dirDatos}`);
  process.exit(1);
}
let texto = fs.readFileSync(path.join(dirDatos, elegida), 'utf8');
let copia = JSON.parse(texto);
console.log(`Copia del ${elegida.slice(0, 10)} (${copia.generado}), ${Object.keys(copia.tablas).length} tablas, ${copia.archivos.length} archivos\n`);

const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const id = (s) => c.escapeIdentifier(s);
let problemas = 0;

// Los archivos que dice la copia tienen que estar en la carpeta, con su tamaño
const local = (a) => path.resolve(dirArchivos, a.bucket, a.ruta);
const faltan = copia.archivos.filter((a) => !fs.existsSync(local(a)) || (a.tam != null && fs.statSync(local(a)).size !== a.tam));
console.log(faltan.length ? `✗ Faltan ${faltan.length} de ${copia.archivos.length} archivos en ${dirArchivos}:` : `✓ Están los ${copia.archivos.length} archivos`);
for (const a of faltan.slice(0, 10)) console.log(`    ${a.bucket}/${a.ruta}`);
problemas += faltan.length;

try {
  if (!deVerdad) {
    // Cada tabla se carga en una gemela vacía y se compara con la real. Al final se deshace todo.
    await c.query('begin');
    await c.query('create schema prueba_restauracion');
    for (const [tabla, filas] of Object.entries(copia.tablas)) {
      await c.query('savepoint t');
      try {
        await c.query(`create table prueba_restauracion.${id(tabla)} (like public.${id(tabla)})`);
        await c.query(`insert into prueba_restauracion.${id(tabla)} select * from jsonb_populate_recordset(null::prueba_restauracion.${id(tabla)}, $1::jsonb)`, [JSON.stringify(filas)]);
        const { rows: [d] } = await c.query(`select
          (select count(*)::int from (select to_jsonb(a) from prueba_restauracion.${id(tabla)} a except select to_jsonb(b) from public.${id(tabla)} b) x) as solo_copia,
          (select count(*)::int from (select to_jsonb(b) from public.${id(tabla)} b except select to_jsonb(a) from prueba_restauracion.${id(tabla)} a) x) as solo_base`);
        const cambios = d.solo_copia + d.solo_base;
        console.log(`  ✓ ${tabla}: ${filas.length} filas${cambios ? `  (la base cambió después de la copia: ${d.solo_base} filas nuevas o distintas)` : ''}`);
        await c.query('release savepoint t');
      } catch (e) {
        await c.query('rollback to savepoint t');
        problemas++;
        console.log(`  ✗ ${tabla}: ${e.message}`);
      }
    }
    await c.query('rollback');
    console.log(problemas ? `\n${problemas} problemas: esta copia NO está completa.` : '\nLa copia se puede restaurar ✓ (prueba: no se guardó nada)');
  } else {
    // Las cuentas del proyecto nuevo tienen otro id: se reemplaza el viejo por el nuevo en toda la copia
    const { rows: actuales } = await c.query('select id, email from auth.users');
    for (const u of copia.usuarios) {
      const nuevo = actuales.find((a) => a.email === u.email);
      if (!nuevo) throw new Error(`No existe la cuenta ${u.email} en este proyecto. Créala primero (Authentication → Users → Add user).`);
      texto = texto.replaceAll(u.id, nuevo.id);
    }
    copia = JSON.parse(texto);

    const { rows: [hay] } = await c.query('select (select count(*) from public.recuerdos) + (select count(*) from public.citas) + (select count(*) from public.respuestas) + (select count(*) from public.cartas) as n');
    if (Number(hay.n) > 0) throw new Error('Esta base ya tiene recuerdos, citas, respuestas o cartas. Solo restauro en un proyecto nuevo, para no pisar nada.');
    if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Faltan VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (del proyecto nuevo) en .env para subir las fotos y los audios.');

    await c.query('begin');
    // Sin triggers ni llaves foráneas mientras se carga: no salen avisos y el orden de las tablas no importa
    await c.query('set local session_replication_role = replica');
    const { rows: existentes } = await c.query("select tablename from pg_tables where schemaname = 'public'");
    const tablas = Object.keys(copia.tablas).filter((t) => existentes.some((e) => e.tablename === t));
    for (const t of Object.keys(copia.tablas)) if (!tablas.includes(t)) console.log(`  ⚠ la tabla ${t} no existe aquí (¿faltan migraciones?): no se restaura`);
    // Lo que dejaron las migraciones y el seed (catálogos, preguntas, configuración) se cambia por lo de la copia
    await c.query(`truncate ${tablas.map((t) => `public.${id(t)}`).join(', ')}`);
    for (const t of tablas) {
      const r = await c.query(`insert into public.${id(t)} select * from jsonb_populate_recordset(null::public.${id(t)}, $1::jsonb)`, [JSON.stringify(copia.tablas[t])]);
      console.log(`  ✓ ${t}: ${r.rowCount} filas`);
    }
    await c.query('commit');

    const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const original = JSON.parse(fs.readFileSync(path.join(dirDatos, elegida), 'utf8')).archivos;
    let subidos = 0;
    for (const [i, a] of copia.archivos.entries()) {
      // En disco está con la ruta vieja; en el proyecto nuevo va con los ids nuevos
      const origen = local(original[i]);
      if (!fs.existsSync(origen)) continue;
      const { error } = await supabase.storage.from(a.bucket).upload(a.ruta, fs.readFileSync(origen), { contentType: a.tipo ?? undefined, upsert: true });
      if (error) { problemas++; console.log(`  ✗ ${a.bucket}/${a.ruta}: ${error.message}`); continue; }
      // Quién lo subió: de eso dependen los permisos para reemplazar o borrar fotos
      if (a.duenio) await c.query('update storage.objects set owner_id = $1 where bucket_id = $2 and name = $3', [a.duenio, a.bucket, a.ruta]).catch((e) => { console.log(`  ⚠ no pude dejar el dueño de ${a.ruta}: ${e.message}`); });
      subidos++;
    }
    console.log(`\nRestaurado: ${tablas.length} tablas y ${subidos} de ${copia.archivos.length} archivos${problemas ? `, con ${problemas} problemas` : ' ✓'}`);
  }
} catch (e) {
  await c.query('rollback').catch(() => {});
  problemas++;
  console.error('ERROR:', e.message);
} finally {
  await c.end();
}
process.exit(problemas ? 1 : 0);
