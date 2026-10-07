// Runner de SQL contra Supabase
import { Client } from 'pg';
import fs from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL (ponla en .env y usa: npm run db:sql -- archivo.sql)');
  process.exit(1);
}
const file = process.argv[2];
const sql = fs.readFileSync(file, 'utf8');
const c = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
try {
  await c.query(sql);
  console.log('OK', file);
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
} finally {
  await c.end();
}
