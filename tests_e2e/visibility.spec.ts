import { test, expect } from '@playwright/test';
import { generateSchemaFromPreset, openGenerator } from './generator-helpers';

test.describe('Visibility & Rendering Checks', () => {

  test.beforeEach(async ({ page }) => {
    // Evaluate to force dark mode in local storage to ensure the app picks it up
    await page.addInitScript(() => {
      localStorage.setItem('theme-preference', 'Dark');
    });
  });

  test('All primary UI elements on Landing page should be visible in Dark Mode', async ({ page }) => {
    await page.goto('http://localhost:4200');
    await page.evaluate(() => document.documentElement.classList.add('dark'));

    await expect(page.getByRole('heading', { name: /Equipose/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Get started/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Learn more/i })).toBeVisible();
    await expect(page.getByText('100% Client-Side', { exact: true })).toBeVisible();
  });

  test('All primary UI elements on Generator page should be visible in Dark Mode', async ({ page }) => {
    await openGenerator(page);
    await page.evaluate(() => document.documentElement.classList.add('dark'));

    await expect(page.getByTestId('generator-page')).toBeVisible();
    await expect(page.getByTestId('generator-heading')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Complex$/i })).toBeVisible();
    await expect(page.getByLabel('Protocol ID')).toBeVisible();
  });

  test('All primary UI elements on Results Grid should be visible in Dark Mode', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Complex');
    await page.evaluate(() => document.documentElement.classList.add('dark'));

    await expect(page.locator('#results-section')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Randomization Schema/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export/i }).first()).toBeVisible();

    // Check table headers
    await expect(page.getByText('Subject ID').first()).toBeVisible();
    await expect(page.getByText('Treatment Arm').first()).toBeVisible();

    // Check data row
    const firstRow = page.locator('[data-testid="result-row"]').first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow.locator('[data-testid="result-arm-cell"]')).toBeVisible();
  });
});
