import { test, expect } from '@playwright/test';
import { generateSchemaFromPreset } from './generator-helpers';

test.describe('Schema Generation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Add an explicit listener for console errors
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
  });

  test('should generate a schema and display results grid', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Complex');

    // Assert that the "Results Grid" section becomes visible
    const resultsSection = page.locator('#results-section');
    await expect(resultsSection).toBeVisible({ timeout: 10000 });

    // Assert that the grid contains rows via the virtual scroll viewport
    const firstRow = page.locator('[data-testid="result-row"]').first();
    await expect(firstRow).toBeVisible();

    const virtualViewport = resultsSection.locator('cdk-virtual-scroll-viewport');
    await expect(virtualViewport).toBeVisible();

    // Verify initial state is blinded
    const armCell = firstRow.locator('[data-testid="result-arm-cell"]');
    await expect(armCell).toContainText('*** BLINDED ***');

    // Click the "Unblinded" toggle
    const unblindedToggleLabel = page.locator('label').filter({ hasText: 'Blinded' }).or(page.locator('label').filter({ hasText: 'Unblinded' }));
    await unblindedToggleLabel.click();

    // Assert the text changes from "*** BLINDED ***"
    await expect(armCell).not.toContainText('*** BLINDED ***');
    // Should be something like High Dose, Low Dose, Placebo
    await expect(armCell).not.toBeEmpty();
  });
});
