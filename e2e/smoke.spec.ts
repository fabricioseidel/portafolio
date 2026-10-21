import { expect, test } from '@playwright/test';

test('la portada carga con todas sus secciones', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const id of ['proyectos', 'stack', 'experiencia', 'certificaciones', 'sobre', 'descargar', 'contacto']) {
    await expect(page.locator(`section#${id}`)).toBeAttached();
  }
});

test('el panel en modo demo edita y actualiza la vista previa', async ({ page, isMobile }) => {
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Probar sin iniciar sesión' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Modo demo' })).toBeVisible();

  const name = page.getByLabel('Nombre (un renglón por línea)');
  await name.fill('Playwright\nPrueba');
  if (isMobile) await page.getByRole('tab', { name: 'Vista previa' }).click();
  await expect(page.getByRole('region', { name: 'Vista previa' }).getByRole('heading', { level: 1 })).toContainText('Playwright');
});

test('el panel pide iniciar sesión y no deja publicar sin token', async ({ page }) => {
  await page.goto('/admin/');
  await expect(page.getByRole('heading', { name: /Edita tu portafolio/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled();
});
