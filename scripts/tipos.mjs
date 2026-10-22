// Genera src/lib/database.types.ts a partir de la base de datos real.
// Correrlo después de cada migración: npm run db:tipos
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const destino = 'src/lib/database.types.ts';
const tipos = execSync(`npx -y supabase@2 gen types typescript --db-url "${process.env.DATABASE_URL}" --schema public`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
writeFileSync(destino, tipos);
execSync(`npx oxfmt ${destino}`, { stdio: 'inherit' });
console.log(`Listo: ${destino}`);
