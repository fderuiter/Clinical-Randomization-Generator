import { test, expect } from '@playwright/test';
import { checkA11y } from './a11y';
import { generateSchemaFromPreset, openGenerator } from './generator-helpers';

test.describe('Accessibility (WCAG 2.1 AA)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
  });

  test('Landing page should have no critical/serious accessibility violations', async ({ page }) => {
    await page.goto('http://localhost:4200');
    await expect(page.getByRole('heading', { name: /Equipose/i })).toBeVisible();
    await checkA11y(page);
  });

  test('About page should have no critical/serious accessibility violations', async ({ page }) => {
    await page.goto('http://localhost:4200/about');
    await expect(page.getByRole('heading', { name: /About Equipose/i })).toBeVisible();
    await checkA11y(page);
  });

  test('Generator page (configuration wizard) should have no critical/serious accessibility violations', async ({ page }) => {
    await openGenerator(page);
    await page.getByRole('button', { name: /^Complex$/i }).waitFor({ state: 'visible' });
    await checkA11y(page);
  });

  test('Results grid should have no critical/serious accessibility violations after schema generation', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Complex');
    await checkA11y(page, '#results-section');
  });
});
