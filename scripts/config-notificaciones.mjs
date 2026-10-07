// Guarda en la base de datos la URL y el secreto de /api/notificar.
// Lee NOTIF_URL y NOTIF_SECRETO de .env: npm run db:notificaciones
import { Client } from 'pg';

const { DATABASE_URL: url, NOTIF_URL, NOTIF_SECRETO } = process.env;
if (!url || !NOTIF_URL || !NOTIF_SECRETO) {
  console.error('Faltan DATABASE_URL, NOTIF_URL o NOTIF_SECRETO en .env');
  process.exit(1);
}
const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query(
    `insert into privado.ajustes (clave, valor) values ('notif_url', $1), ('notif_secreto', $2)
     on conflict (clave) do update set valor = excluded.valor`,
    [NOTIF_URL, NOTIF_SECRETO],
  );
  console.log('OK notificaciones →', NOTIF_URL);
} finally {
  await c.end();
}
