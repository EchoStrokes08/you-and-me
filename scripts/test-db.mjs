// Pruebas de la base: funciones SQL y reglas de seguridad (RLS).
// Todo corre dentro de una transacción que al final se deshace (ROLLBACK):
// no queda nada guardado y no sale ninguna notificación (pg_net solo envía lo confirmado).
// Uso: npm run test:db
import { Client } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL en .env');
  process.exit(1);
}

const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

let fallas = 0;
const prueba = async (nombre, fn) => {
  await c.query('savepoint p');
  try {
    await fn();
    await c.query('release savepoint p');
    console.log(`  ✓ ${nombre}`);
  } catch (e) {
    await c.query('rollback to savepoint p');
    fallas++;
    console.log(`  ✗ ${nombre}\n      ${e.message}`);
  }
};
const igual = (real, esperado, que) => {
  if (JSON.stringify(real) !== JSON.stringify(esperado)) throw new Error(`${que}: esperaba ${JSON.stringify(esperado)}, llegó ${JSON.stringify(real)}`);
};
const falla = async (fn, patron, que) => {
  // Savepoint propio: el error esperado aborta la transacción hasta deshacerlo
  await c.query('savepoint f');
  try { await fn(); await c.query('release savepoint f'); } catch (e) {
    await c.query('rollback to savepoint f');
    if (patron.test(e.message)) return;
    throw new Error(`${que}: falló, pero con otro error: ${e.message}`);
  }
  throw new Error(`${que}: debía fallar y no falló`);
};

// Actuar como un usuario de la app (rol authenticated + su id en el JWT)
const como = async (uid) => {
  await c.query('reset role');
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
  await c.query('set local role authenticated');
};
const comoSistema = () => c.query('reset role');
const q = async (sql, params) => (await c.query(sql, params)).rows;

await c.query('begin');
try {
  const perfiles = await q('select id, rol from public.perfiles');
  const admin = perfiles.find((p) => p.rol === 'admin')?.id;
  const pareja = perfiles.find((p) => p.rol === 'pareja')?.id;
  if (!admin || !pareja) throw new Error('Se necesitan los dos perfiles (admin y pareja) para probar');

  // Pregunta de prueba, nueva, para no tocar las respuestas reales
  const [cat] = await q('select slug from public.categorias_preguntas limit 1');
  const [preg] = await q("insert into public.preguntas (categoria_slug, texto, activo) values ($1, '[prueba] ¿test?', false) returning id", [cat.slug]);

  console.log('\nPregunta del día');
  await prueba('obtener_pregunta_del_dia devuelve la misma pregunta dos veces el mismo día', async () => {
    await como(admin);
    const [a] = await q('select (public.obtener_pregunta_del_dia()).id');
    const [b] = await q('select (public.obtener_pregunta_del_dia()).id');
    if (!a.id) throw new Error('no devolvió pregunta');
    igual(a.id, b.id, 'id');
  });
  await prueba('racha_preguntas devuelve una fila con días ≥ 0', async () => {
    await como(pareja);
    const filas = await q('select * from public.racha_preguntas()');
    igual(filas.length, 1, 'filas');
    if (!(filas[0].dias >= 0)) throw new Error(`días = ${filas[0].dias}`);
  });

  console.log('\nRespuestas: no se ve la del otro hasta responder');
  await como(pareja);
  await q("insert into public.respuestas (pregunta_id, usuario_id, texto) values ($1, $2, 'respuesta de ella')", [preg.id, pareja]);
  await prueba('el admin no ve la respuesta de ella antes de responder (RPC)', async () => {
    await como(admin);
    igual((await q('select * from public.obtener_respuestas($1)', [preg.id])).length, 0, 'filas');
  });
  await prueba('el admin no la ve tampoco leyendo la tabla directo', async () => {
    await como(admin);
    igual((await q('select * from public.respuestas where pregunta_id = $1', [preg.id])).length, 0, 'filas');
  });
  await prueba('estado_respuestas dice que ella ya respondió, sin mostrar el texto', async () => {
    await como(admin);
    const [e] = await q('select * from public.estado_respuestas($1)', [preg.id]);
    igual([e.yo, e.pareja], [false, true], 'estado');
  });
  await prueba('al responder, el admin ya ve las dos', async () => {
    await como(admin);
    await q("insert into public.respuestas (pregunta_id, usuario_id, texto) values ($1, $2, 'respuesta de él')", [preg.id, admin]);
    igual((await q('select * from public.obtener_respuestas($1)', [preg.id])).length, 2, 'filas');
  });
  await prueba('cada uno edita su respuesta, pero no la del otro', async () => {
    await como(pareja);
    igual((await c.query("update public.respuestas set texto = 'editada' where pregunta_id = $1 and usuario_id = $2", [preg.id, pareja])).rowCount, 1, 'propia');
    igual((await c.query("update public.respuestas set texto = 'hackeada' where pregunta_id = $1 and usuario_id = $2", [preg.id, admin])).rowCount, 0, 'ajena');
  });
  await prueba('no se puede responder a nombre del otro', async () => {
    await como(pareja);
    await falla(() => q("insert into public.respuestas (pregunta_id, usuario_id, texto) values ($1, $2, 'x')", [preg.id, admin]), /row-level security|duplicate key/, 'insert');
  });

  console.log('\nRoles y catálogos');
  await prueba('ella no puede volverse admin', async () => {
    await como(pareja);
    await falla(() => q("update public.perfiles set rol = 'admin' where id = $1", [pareja]), /Solo el admin/, 'update rol');
  });
  await prueba('ella no puede crear lugares del catálogo', async () => {
    await como(pareja);
    await falla(() => q("insert into public.lugares (nombre) values ('[prueba]')"), /row-level security/, 'insert lugar');
  });
  await prueba('el admin sí puede', async () => {
    await como(admin);
    igual((await q("insert into public.lugares (nombre) values ('[prueba]') returning id")).length, 1, 'insert lugar');
  });
  await prueba('ella no puede editar la configuración', async () => {
    await como(pareja);
    igual((await c.query("update public.configuracion set nombre_app = 'x' where id = 1")).rowCount, 0, 'filas');
  });

  console.log('\nCartas');
  await como(admin);
  const [carta] = await q("insert into public.cartas (para, titulo, contenido, abrir_desde) values ($1, '[prueba]', 'secreto', current_date + 10) returning id", [pareja]);
  await prueba('ella no puede abrir una carta antes de su fecha', async () => {
    await como(pareja);
    await falla(() => q('select public.abrir_carta($1)', [carta.id]), /.+/, 'abrir');
  });
  await prueba('en cartas_recibidas aparece sin contenido', async () => {
    await como(pareja);
    const filas = await q('select * from public.cartas_recibidas() where id = $1', [carta.id]);
    igual(filas.length, 1, 'filas');
    igual([filas[0].disponible, filas[0].contenido], [false, null], 'disponible/contenido');
  });
  await prueba('ella no puede leer el contenido en la tabla directo', async () => {
    await como(pareja);
    igual((await q('select contenido from public.cartas where id = $1', [carta.id])).length, 0, 'filas');
  });

  console.log('\nRegalos');
  await como(admin);
  const [regalo] = await q("insert into public.regalos (nombre) values ('[prueba]') returning id");
  await prueba('quien pidió el regalo nunca ve si ya se lo compraron', async () => {
    await como(pareja);
    await q('insert into public.regalos_comprados (regalo_id) values ($1)', [regalo.id]);
    await como(admin);
    igual((await q('select * from public.regalos_comprados where regalo_id = $1', [regalo.id])).length, 0, 'filas');
  });

  console.log('\nRecuerdos');
  await como(pareja);
  const [rec] = await q("insert into public.recuerdos (titulo, fecha, creado_por) values ('[prueba]', current_date - 365, $1) returning id", [pareja]);
  await prueba('recuerdo_de_hoy encuentra el de hace un año', async () => {
    await como(admin);
    const filas = await q('select * from public.recuerdo_de_hoy()');
    if (!filas.some((f) => f.id === rec.id)) throw new Error(`no apareció (devolvió ${filas.length} filas)`);
  });
  await prueba('quien lo creó lo edita; el otro no (salvo el admin)', async () => {
    await como(pareja);
    igual((await c.query("update public.recuerdos set titulo = 'editado' where id = $1", [rec.id])).rowCount, 1, 'creadora');
    await como(admin);
    igual((await c.query("update public.recuerdos set titulo = 'admin' where id = $1", [rec.id])).rowCount, 1, 'admin');
  });
  await prueba('014: quien creó el recuerdo puede borrar sus fotos aunque las subiera el otro', async () => {
    await comoSistema();
    const [pol] = await q("select qual from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'recuerdos_delete'");
    if (!pol) throw new Error('no existe la política recuerdos_delete');
    if (!/creado_por/.test(pol.qual)) throw new Error('falta aplicar supabase/migrations/014_editar_recuerdos.sql');
  });
  await prueba('borrar un recuerdo borra sus fotos y notas (cascade)', async () => {
    await como(pareja);
    await q("insert into public.fotos_recuerdo (recuerdo_id, ruta) values ($1, 'x/prueba.jpg')", [rec.id]);
    await q("insert into public.notas_recuerdo (recuerdo_id, usuario_id, texto) values ($1, $2, 'x')", [rec.id, pareja]);
    igual((await c.query('delete from public.recuerdos where id = $1', [rec.id])).rowCount, 1, 'borrado');
    await comoSistema();
    igual((await q('select 1 from public.fotos_recuerdo where recuerdo_id = $1', [rec.id])).length, 0, 'fotos');
    igual((await q('select 1 from public.notas_recuerdo where recuerdo_id = $1', [rec.id])).length, 0, 'notas');
  });

  console.log('\nCápsulas del tiempo (015)');
  await como(admin);
  const [cap] = await q("insert into public.capsulas (titulo, abrir_en) values ('[prueba]', current_date + 30) returning id");
  await q("insert into public.capsula_items (capsula_id, tipo, texto) values ($1, 'texto', 'secreto de él')", [cap.id]);
  await prueba('no se puede crear una cápsula que ya esté abierta', async () => {
    await como(pareja);
    await falla(() => q("insert into public.capsulas (titulo, abrir_en) values ('x', current_date)"), /row-level security/, 'insert');
  });
  await prueba('mientras está sellada, ella no ve lo que él guardó', async () => {
    await como(pareja);
    igual((await q('select * from public.capsula_items where capsula_id = $1', [cap.id])).length, 0, 'filas');
  });
  await prueba('cada uno sí ve lo suyo', async () => {
    await como(admin);
    igual((await q('select * from public.capsula_items where capsula_id = $1', [cap.id])).length, 1, 'filas');
  });
  await prueba('el conteo dice cuántas cosas guardó cada uno, sin contenido', async () => {
    await como(pareja);
    const filas = await q('select * from public.capsulas_conteo() where capsula_id = $1', [cap.id]);
    igual(filas.map((f) => [f.de === admin, f.cantidad]), [[true, 1]], 'conteo');
  });
  await prueba('ella puede guardar algo; él no puede borrar la cápsula después', async () => {
    await como(pareja);
    await q("insert into public.capsula_items (capsula_id, tipo, texto) values ($1, 'texto', 'secreto de ella')", [cap.id]);
    await como(admin);
    igual((await c.query('delete from public.capsulas where id = $1', [cap.id])).rowCount, 0, 'borrado');
  });
  await prueba('al llegar la fecha, los dos ven todo y ya no se puede agregar', async () => {
    await comoSistema();
    await q('update public.capsulas set abrir_en = current_date - 1 where id = $1', [cap.id]);
    await como(pareja);
    igual((await q('select * from public.capsula_items where capsula_id = $1', [cap.id])).length, 2, 'filas');
    await falla(() => q("insert into public.capsula_items (capsula_id, tipo, texto) values ($1, 'texto', 'tarde')", [cap.id]), /row-level security/, 'insert');
  });
  await prueba('adjuntos: la cápsula abierta se puede ver; la de una carta sin abrir, no', async () => {
    await como(admin);
    const [carta2] = await q("insert into public.cartas (para, titulo, contenido, abrir_desde) values ($1, '[prueba]', 'x', current_date + 5) returning id", [pareja]);
    await como(pareja);
    const [r] = await q("select public.puede_ver_adjunto($1) as capsula, public.puede_ver_adjunto($2) as carta, public.puede_ver_adjunto('otra/x') as otra",
      [`capsulas/${cap.id}/a.jpg`, `cartas/${carta2.id}/voz.m4a`]);
    igual([r.capsula, r.carta, r.otra], [true, false, false], 'permisos');
  });
} catch (e) {
  fallas++;
  console.error('\nERROR preparando las pruebas:', e.message);
} finally {
  await c.query('rollback');
  await c.end();
}

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodo bien ✓ (nada quedó guardado)');
process.exit(fallas ? 1 : 0);
