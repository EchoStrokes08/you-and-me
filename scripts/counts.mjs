import { Client } from 'pg';
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL (ponla en .env y usa: npm run db:sql -- archivo.sql)');
  process.exit(1);
}
const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`select (select count(*) from lugares) l,(select count(*) from actividades) a,(select count(*) from lugar_actividad) la,(select count(*) from preguntas) p,(select count(*) from categorias_cita) cc,(select count(*) from franjas) f,(select count(*) from opciones_llevar) o`);
console.log(r.rows[0]);
await c.end();
