import { Client } from 'pg';
const c = new Client({
  connectionString: process.argv[2] ?? process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const r = await c.query('select version()');
console.log('OK', r.rows[0].version);
await c.end();
