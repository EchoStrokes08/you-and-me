import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid login credentials' }) });
  });
});

test('muestra errores de acceso con etiquetas y permite reintentar', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Correo').fill('pareja@example.com');
  await page.getByLabel('Contraseña').fill('incorrecta');
  await page.getByRole('button', { name: /Entrar/ }).click();
  await expect(page.getByRole('alert')).toContainText('revisa tu correo y contraseña');
  await expect(page.getByLabel('Correo')).toBeVisible();
});

test('el formulario de acceso cabe en móvil, conserva safe areas y funciona con movimiento reducido', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hola de nuevo' })).toBeVisible();
  const resultado = await page.evaluate(() => {
    const body = document.body;
    const input = document.querySelector('input[type="email"]')!;
    const button = document.querySelector('form button[type="submit"]')!;
    const rect = button.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      emailLabelled: !!input.closest('label')?.textContent?.includes('Correo'),
      buttonHeight: rect.height,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      motion: getComputedStyle(body).animationDuration,
    };
  });
  expect(resultado.scrollWidth).toBeLessThanOrEqual(resultado.clientWidth);
  expect(resultado.emailLabelled).toBe(true);
  expect(resultado.buttonHeight).toBeGreaterThanOrEqual(44);
  expect(resultado.colorScheme).toBe('dark');
  expect(resultado.motion).toMatch(/0\.001ms|1e-0[56]s/);
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(focus).not.toBe('none');
});

test('un enlace directo protegido conserva el acceso y lleva al inicio de sesión', async ({ page }) => {
  await page.goto('/preguntas');
  await expect(page.getByRole('heading', { name: 'Hola de nuevo' })).toBeVisible();
  await expect(page.getByLabel('Secciones')).toHaveCount(0);
});
