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
  // Las pruebas parten de que solo él tiene el permiso de admin, esté como esté hoy en la base
  await q('update public.permisos set es_admin = (usuario_id = $1)', [admin]);

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
  await prueba('ella no puede darse el permiso de admin', async () => {
    await como(pareja);
    await falla(() => q('update public.permisos set es_admin = true where usuario_id = $1', [pareja]), /permission denied/, 'update permisos');
  });
  await prueba('con el permiso prendido desde la base, ella hace lo del admin sin cambiar de rol', async () => {
    await comoSistema();
    await q('update public.permisos set es_admin = true where usuario_id = $1', [pareja]);
    await como(pareja);
    igual((await q('select public.es_admin() ok'))[0].ok, true, 'es_admin');
    igual((await q("insert into public.lugares (nombre) values ('[prueba]') returning id")).length, 1, 'insert lugar');
    igual((await q('select rol from public.perfiles where id = $1', [pareja]))[0].rol, 'pareja', 'rol');
    await comoSistema();
    await q('update public.permisos set es_admin = false where usuario_id = $1', [pareja]);
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
  await prueba('ella sí puede cambiar las mascotas', async () => {
    await como(pareja);
    // El acompañante que esté escogido de verdad: pasar null no lo debe cambiar
    const [antes] = await q('select componente_secundario from public.configuracion where id = 1');
    await q("select public.guardar_mascotas('orca', null)");
    const [cfg] = await q('select componente_primario, componente_secundario from public.configuracion where id = 1');
    igual(cfg.componente_primario, 'orca', 'primario');
    igual(cfg.componente_secundario, antes.componente_secundario, 'secundario');
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
  const [rec] = await q("insert into public.recuerdos (titulo, fecha, creado_por) values ('[prueba]', public.hoy_bogota() - 365, $1) returning id", [pareja]);
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
    await falla(() => q("insert into public.capsulas (titulo, abrir_en) values ('x', public.hoy_bogota())"), /row-level security/, 'insert');
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

  console.log('\nReacciones a las respuestas (025)');
  await comoSistema();
  const [preg2] = await q("insert into public.preguntas (categoria_slug, texto, activo) values ($1, '[prueba] ¿reacciones?', false) returning id", [cat.slug]);
  await como(pareja);
  const [resp2] = await q("insert into public.respuestas (pregunta_id, usuario_id, texto) values ($1, $2, 'lo de ella') returning id", [preg2.id, pareja]);
  await prueba('no se puede reaccionar a una respuesta que todavía no se puede ver', async () => {
    await como(admin);
    await falla(() => q('insert into public.reacciones_respuesta (respuesta_id, corazon) values ($1, true)', [resp2.id]), /row-level security/, 'insert');
  });
  await prueba('ya respondida la pregunta, él reacciona y ella lo ve', async () => {
    await como(admin);
    await q("insert into public.respuestas (pregunta_id, usuario_id, texto) values ($1, $2, 'lo de él')", [preg2.id, admin]);
    await q("insert into public.reacciones_respuesta (respuesta_id, corazon, texto) values ($1, true, 'qué lindo')", [resp2.id]);
    await como(pareja);
    const filas = await q('select corazon, texto from public.reacciones_respuesta where respuesta_id = $1', [resp2.id]);
    igual(filas, [{ corazon: true, texto: 'qué lindo' }], 'reacción');
  });
  await prueba('nadie reacciona a su propia respuesta ni cambia la reacción del otro', async () => {
    await como(pareja);
    await falla(() => q('insert into public.reacciones_respuesta (respuesta_id, corazon) values ($1, true)', [resp2.id]), /row-level security/, 'insert');
    igual((await c.query("update public.reacciones_respuesta set texto = 'cambiada' where respuesta_id = $1", [resp2.id])).rowCount, 0, 'update ajeno');
    igual((await c.query('delete from public.reacciones_respuesta where respuesta_id = $1', [resp2.id])).rowCount, 0, 'delete ajeno');
  });

  console.log('\nPreguntas propias (025)');
  await como(pareja);
  const [propia] = await q("insert into public.preguntas_propias (texto) values ('[prueba] ¿la escribí yo?') returning id");
  await prueba('la pregunta que ella escribió no la ve él', async () => {
    await como(admin);
    igual((await q('select id from public.preguntas_propias where id = $1', [propia.id])).length, 0, 'filas que ve él');
    await como(pareja);
    igual((await q('select id from public.preguntas_propias where id = $1', [propia.id])).length, 1, 'filas que ve ella');
  });
  await prueba('algún día sale como pregunta del día, con su autora, y queda marcada como usada', async () => {
    // Sale más o menos una de cada tres veces: se repite "un día nuevo" hasta que le toque
    for (let i = 0; i < 120; i++) {
      await comoSistema();
      await q('delete from public.pregunta_del_dia where fecha = public.hoy_bogota()');
      await como(admin);
      await q('select public.obtener_pregunta_del_dia()');
      await comoSistema();
      const [u] = await q('select usada_en, pregunta_id from public.preguntas_propias where id = $1', [propia.id]);
      if (!u.usada_en) continue;
      const [p] = await q('select texto, activo, propuesta_por from public.preguntas where id = $1', [u.pregunta_id]);
      igual([p.texto, p.activo, p.propuesta_por], ['[prueba] ¿la escribí yo?', false, pareja], 'pregunta creada');
      const [d] = await q('select pregunta_id from public.pregunta_del_dia where fecha = public.hoy_bogota()');
      igual(d.pregunta_id, u.pregunta_id, 'pregunta de hoy');
      return;
    }
    throw new Error('nunca salió en 120 intentos');
  });
  await prueba('ya usada, no se puede borrar ni cambiar', async () => {
    await como(pareja);
    igual((await c.query('delete from public.preguntas_propias where id = $1', [propia.id])).rowCount, 0, 'delete');
    igual((await c.query("update public.preguntas_propias set texto = 'otra cosa distinta' where id = $1", [propia.id])).rowCount, 0, 'update');
  });

  console.log('\nRecordatorio de la copia (025)');
  await prueba('ella no puede marcar la copia como hecha', async () => {
    await como(pareja);
    igual((await c.query('update public.configuracion set ultima_copia = now() where id = 1')).rowCount, 0, 'update');
  });
  await prueba('sin copia reciente se avisa una vez por semana; con copia reciente, no', async () => {
    await comoSistema();
    await q('update public.configuracion set ultima_copia = null, copia_avisada_en = null where id = 1');
    await q('select public.avisar_copia_pendiente()');
    const [a] = await q('select copia_avisada_en = public.hoy_bogota() as hoy from public.configuracion where id = 1');
    igual(a.hoy, true, 'avisó hoy');
    await q("update public.configuracion set ultima_copia = now() - interval '40 days', copia_avisada_en = public.hoy_bogota() - 3 where id = 1");
    await q('select public.avisar_copia_pendiente()');
    const [b] = await q('select copia_avisada_en = public.hoy_bogota() - 3 as igual from public.configuracion where id = 1');
    igual(b.igual, true, 'no repite antes de una semana');
    await q('update public.configuracion set ultima_copia = now(), copia_avisada_en = null where id = 1');
    await q('select public.avisar_copia_pendiente()');
    const [d] = await q('select copia_avisada_en from public.configuracion where id = 1');
    igual(d.copia_avisada_en, null, 'con copia reciente no avisa');
  });

  console.log('\nCita vivida, notas, lugares por conocer, favoritas y avisos (026)');
  await comoSistema();
  const [fr] = await q('select id from public.franjas limit 1');
  const [citaAyer] = await q("insert into public.citas (creada_por, fecha, franja_id, estado) values ($1, public.hoy_bogota() - 1, $2, 'confirmada') returning id", [admin, fr.id]);
  const [citaFutura] = await q("insert into public.citas (creada_por, fecha, franja_id, estado) values ($1, public.hoy_bogota() + 5, $2, 'confirmada') returning id", [pareja, fr.id]);
  const [rec26] = await q("insert into public.recuerdos (titulo, fecha, creado_por) values ('[prueba]', public.hoy_bogota(), $1) returning id", [admin]);
  const [nota] = await q("insert into public.notas_recuerdo (recuerdo_id, usuario_id, texto) values ($1, $2, 'de él') returning id", [rec26.id, admin]);
  const [foto] = await q("insert into public.fotos_recuerdo (recuerdo_id, ruta) values ($1, 'prueba/x.jpg') returning id", [rec26.id]);
  await prueba('ella marca como vivida una cita confirmada que ya pasó, pero no una futura', async () => {
    await como(pareja);
    igual((await c.query("update public.citas set estado = 'vivida' where id = $1", [citaAyer.id])).rowCount, 1, 'la de ayer');
    await falla(() => c.query("update public.citas set estado = 'vivida' where id = $1", [citaFutura.id]), /row-level security/, 'la futura');
  });
  await prueba('cada uno borra solo su nota de un recuerdo', async () => {
    await como(pareja);
    igual((await c.query('delete from public.notas_recuerdo where id = $1', [nota.id])).rowCount, 0, 'ella con la de él');
    await como(admin);
    igual((await c.query('delete from public.notas_recuerdo where id = $1', [nota.id])).rowCount, 1, 'él con la suya');
  });
  await prueba('los lugares por conocer son de los dos: ella agrega, él anota y quita', async () => {
    await como(pareja);
    const [l] = await q("insert into public.lugares_por_conocer (nombre, lat, lng) values ('[prueba]', 4.65, -74.05) returning id, creado_por");
    igual(l.creado_por, pareja, 'creado_por');
    await como(admin);
    igual((await c.query("update public.lugares_por_conocer set nota = 'postres' where id = $1", [l.id])).rowCount, 1, 'update');
    igual((await c.query('delete from public.lugares_por_conocer where id = $1', [l.id])).rowCount, 1, 'delete');
  });
  await prueba('la foto favorita se marca con la función; la ruta no se puede tocar', async () => {
    await como(pareja);
    await q('select public.marcar_favorita($1, true)', [foto.id]);
    igual((await q('select favorita from public.fotos_recuerdo where id = $1', [foto.id]))[0].favorita, true, 'favorita');
    igual((await c.query("update public.fotos_recuerdo set ruta = 'otra' where id = $1", [foto.id])).rowCount, 0, 'update directo');
  });
  await prueba('lo que alguien silencia no se le envía; lo de citas siempre', async () => {
    await como(pareja);
    igual((await c.query("update public.perfiles set avisos_silenciados = '{animo}' where id = $1", [pareja])).rowCount, 1, 'silenciar lo propio');
    igual((await c.query("update public.perfiles set avisos_silenciados = '{animo}' where id = $1", [admin])).rowCount, 0, 'silenciar lo del otro');
    await comoSistema();
    await q("insert into public.suscripciones_push (endpoint, p256dh, auth, usuario_id) values ('https://prueba.invalid/x', 'a', 'b', $1)", [pareja]);
    const cola = async () => Number((await q('select count(*) n from net.http_request_queue'))[0].n);
    const antes = await cola();
    await q("select public.enviar_push($1, 'animo', 'x', '{}'::jsonb)", [pareja]);
    igual(await cola(), antes, 'ánimo silenciado');
    await q("select public.enviar_push($1, 'cita_nueva', 'x', '{}'::jsonb)", [pareja]);
    igual(await cola(), antes + 1, 'cita nueva');
  });

  console.log('\nPanel: notificaciones, pregunta del día y borrar citas (031)');
  await prueba('solo el admin ve el estado de las notificaciones y manda una de prueba', async () => {
    await como(pareja);
    igual((await q('select * from public.estado_notificaciones()')).length, 0, 'filas para ella');
    await falla(() => q('select public.probar_notificacion($1)', [pareja]), /Solo el admin/, 'prueba de ella');
    await como(admin);
    const filas = await q('select * from public.estado_notificaciones()');
    igual(filas.length, 2, 'filas para el admin');
    // Arriba se le agregó una suscripción de prueba, además de las reales que tenga
    if (!(filas.find((f) => f.usuario_id === pareja).celulares >= 1)) throw new Error('no contó los celulares de ella');
    await q('select public.probar_notificacion($1)', [pareja]);
  });
  await prueba('solo el admin deja una pregunta para otro día; la de hoy no se cambia si ya la respondieron', async () => {
    await comoSistema();
    const [otra] = await q("insert into public.preguntas (categoria_slug, texto, activo) values ($1, '[prueba] ¿otra?', false) returning id", [cat.slug]);
    const [{ hoy, luego }] = await q("select public.hoy_bogota()::text hoy, (public.hoy_bogota() + 400)::text luego");
    await como(pareja);
    await falla(() => q('select public.fijar_pregunta_del_dia($1, $2)', [luego, otra.id]), /Solo el admin/, 'ella');
    await como(admin);
    await q('select public.fijar_pregunta_del_dia($1, $2)', [luego, otra.id]);
    igual((await q('select pregunta_id from public.pregunta_del_dia where fecha = $1', [luego]))[0].pregunta_id, otra.id, 'programada');
    await falla(() => q('select public.fijar_pregunta_del_dia(public.hoy_bogota() - 1, $1)', [otra.id]), /ya pasó/, 'día pasado');
    // La de hoy pasa a ser la pregunta de prueba, que los dos respondieron arriba
    await comoSistema();
    await q('insert into public.pregunta_del_dia (fecha, pregunta_id) values ($1, $2) on conflict (fecha) do update set pregunta_id = excluded.pregunta_id', [hoy, preg.id]);
    await como(admin);
    await falla(() => q('select public.fijar_pregunta_del_dia($1, $2)', [hoy, otra.id]), /Ya respondieron/, 'hoy respondida');
  });
  await prueba('el admin borra una cita cancelada del todo; ella no', async () => {
    await comoSistema();
    const [cita] = await q("insert into public.citas (creada_por, fecha, franja_id, estado) values ($1, public.hoy_bogota() + 5, $2, 'cancelada') returning id", [admin, fr.id]);
    await como(pareja);
    igual((await c.query('delete from public.citas where id = $1', [cita.id])).rowCount, 0, 'ella');
    await como(admin);
    igual((await c.query('delete from public.citas where id = $1', [cita.id])).rowCount, 1, 'admin');
  });

  console.log('\nVales, pelis, retos, lo que me gustó y días importantes (032)');
  await prueba('un vale: solo quien lo recibe lo redime y solo quien lo regaló lo cumple', async () => {
    await como(admin);
    const [v] = await q("insert into public.vales (para, titulo) values ($1, 'Un masaje') returning id", [pareja]);
    await falla(() => q('select public.redimir_vale($1)', [v.id]), /no se puede redimir/, 'él redime el suyo');
    await como(pareja);
    await falla(() => q('select public.cumplir_vale($1)', [v.id]), /no se puede marcar/, 'ella cumple antes de tiempo');
    await q('select public.redimir_vale($1)', [v.id]);
    await falla(() => q('select public.redimir_vale($1)', [v.id]), /no se puede redimir/, 'redimirlo dos veces');
    await como(admin);
    igual((await c.query('delete from public.vales where id = $1', [v.id])).rowCount, 0, 'retirarlo ya redimido');
    await q('select public.cumplir_vale($1)', [v.id]);
  });
  await prueba('nadie se regala un vale a sí mismo ni a nombre del otro', async () => {
    await como(admin);
    await falla(() => q("insert into public.vales (para, titulo) values ($1, 'x')", [admin]), /check/, 'a sí mismo');
    await falla(() => q("insert into public.vales (de, para, titulo) values ($1, $2, 'x')", [pareja, admin]), /row-level security/, 'a nombre de ella');
  });
  await prueba('cada uno califica la peli por su lado', async () => {
    await como(pareja);
    const [p] = await q("insert into public.pelis (titulo) values ('Up') returning id");
    await q('insert into public.pelis_calificacion (peli_id, estrellas) values ($1, 5)', [p.id]);
    await como(admin);
    await falla(() => q('insert into public.pelis_calificacion (peli_id, usuario_id, estrellas) values ($1, $2, 1)', [p.id, pareja]), /row-level security/, 'a nombre de ella');
    igual((await c.query('update public.pelis_calificacion set estrellas = 1 where peli_id = $1', [p.id])).rowCount, 0, 'cambiar la de ella');
    igual((await c.query('delete from public.pelis where id = $1', [p.id])).rowCount, 1, 'el admin la quita');
  });
  await prueba('el reto del mes es el mismo para los dos y se cambia solo mientras no esté cumplido', async () => {
    await como(admin);
    const [r1] = await q('select * from public.reto_del_mes()');
    await como(pareja);
    const [r2] = await q('select * from public.reto_del_mes()');
    igual(r2.reto_id, r1.reto_id, 'mismo reto');
    await q('select public.cambiar_reto_del_mes()');
    const [r3] = await q('select * from public.reto_del_mes()');
    if (r3.reto_id === r1.reto_id) throw new Error('no cambió el reto');
    await q('update public.retos_mes set cumplido_en = public.hoy_bogota() where mes = $1', [r3.mes]);
    await falla(() => q('select public.cambiar_reto_del_mes()'), /ya está cumplido/, 'cambiar uno cumplido');
    await falla(() => q('update public.retos_mes set reto_id = $1 where mes = $2', [r1.reto_id, r3.mes]), /permission denied/, 'cambiar el reto a mano');
  });
  await prueba('lo que me gustó de hoy: el otro no lo ve hasta mañana', async () => {
    await como(pareja);
    await q("insert into public.gratitudes (texto) values ('Tu risa')");
    await falla(() => q("insert into public.gratitudes (fecha, texto) values (public.hoy_bogota() - 1, 'x')"), /row-level security/, 'escribir el de ayer');
    await como(admin);
    igual((await q("select * from public.gratitudes where usuario_id = $1 and fecha = public.hoy_bogota()", [pareja])).length, 0, 'él hoy');
    await comoSistema();
    await q("update public.gratitudes set fecha = public.hoy_bogota() - 1 where usuario_id = $1 and texto = 'Tu risa'", [pareja]);
    await como(admin);
    igual((await q("select texto from public.gratitudes where usuario_id = $1 and texto = 'Tu risa'", [pareja])).length, 1, 'él mañana');
  });
  await prueba('días importantes: cada uno anota los suyos y se avisan una sola vez', async () => {
    await como(pareja);
    const [d] = await q("insert into public.dias_importantes (fecha, titulo) values (public.hoy_bogota(), 'Examen') returning id");
    await falla(() => q("insert into public.dias_importantes (usuario_id, fecha, titulo) values ($1, public.hoy_bogota(), 'x')", [admin]), /row-level security/, 'a nombre de él');
    await como(admin);
    igual((await c.query('delete from public.dias_importantes where id = $1', [d.id])).rowCount, 0, 'él borra el de ella');
    await comoSistema();
    await q('select public.avisar_dias_importantes()');
    igual((await q('select avisado from public.dias_importantes where id = $1', [d.id]))[0].avisado, true, 'avisado');
  });
  await prueba('contar_logros devuelve solo números', async () => {
    await como(pareja);
    const [{ l }] = await q('select public.contar_logros() as l');
    if (typeof l.recuerdos !== 'number' || typeof l.vales !== 'number') throw new Error(JSON.stringify(l));
  });

  console.log('\nAsistente (033)');
  await prueba('cada uno ve y borra solo su conversación con el asistente', async () => {
    await como(pareja);
    await q("insert into public.asistente_mensajes (rol, contenido) values ('user', 'hola')");
    igual((await q('select public.preguntas_al_asistente_hoy() as n'))[0].n >= 1, true, 'conteo');
    await como(admin);
    igual((await q('select * from public.asistente_mensajes where usuario_id = $1', [pareja])).length, 0, 'él no la ve');
    igual((await c.query('delete from public.asistente_mensajes where usuario_id = $1', [pareja])).rowCount, 0, 'él no la borra');
    await falla(() => q("insert into public.asistente_mensajes (usuario_id, rol, contenido) values ($1, 'user', 'x')", [pareja]), /row-level security/, 'a nombre de ella');
  });

  console.log('\nCiclo (034)');
  const sobre = JSON.stringify({ iv: 'x', ct: 'y' });
  const opaco = 'a'.repeat(32);
  await prueba('sus registros del ciclo no los ve nadie más, tampoco el admin', async () => {
    await como(pareja);
    await q('insert into public.ciclo_llaves (publica, llavero) values ($1, $2)', ['{"kty":"EC"}', sobre]);
    await q('insert into public.ciclo_datos (id, sobre) values ($1, $2)', [opaco, sobre]);
    await como(admin);
    igual((await q('select * from public.ciclo_datos where usuario_id = $1', [pareja])).length, 0, 'él lee los datos');
    igual((await q('select * from public.ciclo_llaves where usuario_id = $1', [pareja])).length, 0, 'él lee el llavero');
    igual((await c.query('delete from public.ciclo_datos where usuario_id = $1', [pareja])).rowCount, 0, 'él borra');
    await falla(() => q('insert into public.ciclo_datos (usuario_id, id, sobre) values ($1, $2, $3)', [pareja, 'b'.repeat(32), sobre]), /row-level security/, 'a nombre de ella');
  });
  await prueba('de la llave de ella, él solo obtiene la pública', async () => {
    await como(admin);
    const filas = await q('select * from public.ciclo_llave_pareja()');
    igual(filas.length, 1, 'filas');
    igual(Object.keys(filas[0]).sort(), ['publica', 'usuario_id'], 'columnas');
    igual((await q('select public.ciclo_id_pareja() as id'))[0].id, pareja, 'pareja');
  });
  await prueba('los nombres de los registros deben ser opacos', async () => {
    await como(pareja);
    await falla(() => q('insert into public.ciclo_datos (id, sobre) values ($1, $2)', ['dia:2026-10-20', sobre]), /check constraint/, 'nombre con fecha');
  });
  await prueba('lo compartido: él lo lee, no lo cambia; ella lo revoca', async () => {
    await como(pareja);
    await q('insert into public.ciclo_compartido (destino, sobre) values ($1, $2)', [admin, sobre]);
    await como(admin);
    igual((await q('select duena from public.ciclo_compartido where duena = $1', [pareja])).length, 1, 'él lo ve');
    igual((await c.query('update public.ciclo_compartido set sobre = $1 where duena = $2', ['{}', pareja])).rowCount, 0, 'él lo cambia');
    igual((await c.query('delete from public.ciclo_compartido where duena = $1', [pareja])).rowCount, 0, 'él lo borra');
    await como(pareja);
    igual((await c.query('delete from public.ciclo_compartido where duena = $1', [pareja])).rowCount, 1, 'ella revoca');
    await como(admin);
    igual((await q('select * from public.ciclo_compartido where duena = $1', [pareja])).length, 0, 'ya no lo ve');
  });
  await prueba('un aviso programado no se deja ver antes de su hora; él no puede editarlo', async () => {
    await como(pareja);
    const [futuro] = await q("insert into public.ciclo_avisos (para, enviar_en, sobre) values ($1, now() + interval '3 days', $2) returning id", [admin, sobre]);
    await como(admin);
    igual((await q('select * from public.ciclo_avisos where id = $1', [futuro.id])).length, 0, 'él ve el futuro');
    await falla(() => q("update public.ciclo_avisos set enviar_en = now() where id = $1", [futuro.id]), /permission denied/, 'él lo adelanta');
    await falla(() => q("insert into public.ciclo_avisos (para, enviar_en, sobre) values ($1, now() + interval '200 days', $2)", [pareja, sobre]), /row-level security/, 'muy lejos');
    await como(pareja);
    const [ya] = await q('insert into public.ciclo_avisos (para, sobre) values ($1, $2) returning id', [admin, sobre]);
    await comoSistema();
    if (!(await q('select enviado_en from public.ciclo_avisos where id = $1', [ya.id]))[0].enviado_en) throw new Error('el aviso del momento no salió');
    await como(admin);
    igual((await q('select id from public.ciclo_avisos where id = $1', [ya.id])).length, 1, 'él ve el del momento');
    igual((await c.query('delete from public.ciclo_avisos where id = $1', [ya.id])).rowCount, 1, 'él lo descarta');
  });
  await prueba('los avisos del ciclo se pueden silenciar', async () => {
    igual((await q("select public.grupo_aviso('ciclo') as g"))[0].g, 'ciclo', 'grupo');
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
