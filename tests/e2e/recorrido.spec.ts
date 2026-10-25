// Prueba de navegador con Playwright, inactiva: el script test:e2e y la dependencia se retiraron; no se ejecuta con npm test.
import { expect, test, type Page } from '@playwright/test';

/* Entra con una cuenta real y recorre todas las pantallas solo mirando: no crea, cambia ni borra nada.
   Necesita E2E_EMAIL y E2E_CLAVE en .env; sin ellas la prueba se salta. */

const EMAIL = process.env.E2E_EMAIL;
const CLAVE = process.env.E2E_CLAVE;

const PANTALLAS = [
  '/', '/citas', '/preguntas', '/historia', '/cartas', '/cartas?tab=escritas', '/cartas?tab=capsulas',
  '/juntos', '/juntos?tab=cupones', '/juntos?tab=pelis', '/juntos?tab=regalos', '/juntos?tab=canciones',
  '/lugares', '/dias', '/logros', '/resumen', '/asistente', '/ciclo',
];

// Lo que nunca debería verse en pantalla
const SEÑALES_DE_FALLA = [
  'Esta pantalla tuvo un problema', // ErrorBoundary
  'Algunas cosas no cargaron', // el aviso falso de conexión que se quitó
  'No pude cargar tu perfil',
  'Invalid Date',
  'NaN',
  'undefined',
];

async function entrar(page: Page) {
  await page.goto('/');
  await page.getByLabel('Correo').fill(EMAIL!);
  await page.getByLabel('Contraseña').fill(CLAVE!);
  await page.getByRole('button', { name: /Entrar/ }).click();
  await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 20_000 });
}

async function esperarQueCargue(page: Page) {
  // Realtime deja una conexión abierta: si la red nunca queda quieta, se sigue igual
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

test('con sesión, todas las pantallas cargan sin errores', async ({ page }) => {
  test.skip(!EMAIL || !CLAVE, 'Falta E2E_EMAIL / E2E_CLAVE en .env');
  test.setTimeout(180_000);

  const fallasJs: string[] = [];
  const erroresConsola: string[] = [];
  page.on('pageerror', (e) => fallasJs.push(`${page.url()} → ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erroresConsola.push(`${page.url()} → ${m.text()}`); });
  // Las respuestas fallidas, con su dirección (la consola solo dice "Failed to load resource")
  page.on('response', (r) => { if (r.status() >= 400) erroresConsola.push(`${page.url()} → ${r.status()} ${r.request().method()} ${r.url().split('?')[0]}`); });

  await entrar(page);

  const problemas: string[] = [];
  for (const ruta of PANTALLAS) {
    await page.goto(ruta);
    await esperarQueCargue(page);
    const texto = await page.locator('body').innerText();
    for (const señal of SEÑALES_DE_FALLA) if (texto.includes(señal)) problemas.push(`${ruta}: se ve «${señal}»`);
    const desborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (desborda) problemas.push(`${ruta}: la página se sale de lado`);
  }

  // El panel (si esta cuenta es admin): cada pestaña
  await page.goto('/admin');
  await esperarQueCargue(page);
  if (await page.getByRole('heading', { name: 'Panel' }).isVisible()) {
    for (const pestaña of ['Solicitudes', 'Catálogos', 'Preguntas', 'Fechas', 'Config']) {
      await page.getByRole('tab', { name: pestaña }).or(page.getByRole('button', { name: pestaña, exact: true })).first().click();
      await esperarQueCargue(page);
      const texto = await page.locator('body').innerText();
      for (const señal of SEÑALES_DE_FALLA) if (texto.includes(señal)) problemas.push(`/admin ${pestaña}: se ve «${señal}»`);
    }
  }

  if (erroresConsola.length) console.log('Errores en la consola (no rompen la prueba):\n' + erroresConsola.join('\n'));
  expect(fallasJs, 'Errores de JavaScript sin atrapar').toEqual([]);
  expect(problemas).toEqual([]);
});
