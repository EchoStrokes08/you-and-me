// Revisa que DATABASE_URL conecta a la base, imprimiendo la versión de PostgreSQL.
// Se ejecuta con # node scripts/db-check.mjs [url]; si no pasa la url, usa el DATABASE_URL del entorno. Solo lee.
import { Client } from 'pg';
const c = new Client({
  connectionString: process.argv[2] ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const r = await c.query('select version()');
console.log('OK', r.rows[0].version);
await c.end();
