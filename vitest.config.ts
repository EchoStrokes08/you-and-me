import { defineConfig } from 'vitest/config';

// Pruebas de la lógica que no necesita navegador ni base (las de la base son `npm run test:db`)
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
