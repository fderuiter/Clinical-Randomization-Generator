import { test, expect } from '@playwright/test';

test.describe('Schema Generation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Add an explicit listener for console errors
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
    await page.goto('http://localhost:4200');
  });

  test('should generate a schema and display results grid', async ({ page }) => {
    // Navigate to generator page
    const getStartedBtn = page.getByRole('link', { name: /Get Started/i });
    if (await getStartedBtn.isVisible()) {
      await getStartedBtn.click();
    }

    // Click the "Complex (Multi-strata)" preset button
    const complexPresetBtn = page.getByRole('button', { name: /Complex \(Multi-strata\)/i });
    await expect(complexPresetBtn).toBeVisible();
    await complexPresetBtn.click();

    // Click "Generate Schema" button
    const generateSchemaBtn = page.getByRole('button', { name: /Generate Schema/i });
    await expect(generateSchemaBtn).toBeVisible();
    // Verify it is enabled
    await expect(generateSchemaBtn).not.toBeDisabled();
    await generateSchemaBtn.click();

    // Assert that the "Results Grid" section becomes visible
    const resultsSection = page.locator('#results-section');
    await expect(resultsSection).toBeVisible({ timeout: 10000 });

    // Assert that the grid contains rows and the pagination controls are visible
    const tableRows = resultsSection.locator('tbody tr');
    // Ensure we have at least one row
    await expect(tableRows.first()).toBeVisible();
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);

    const paginationControls = resultsSection.locator('nav[aria-label="Pagination"]');
    await expect(paginationControls).toBeVisible();

    // Verify initial state is blinded
    const firstRowTreatmentCell = tableRows.first().locator('td').last();
    await expect(firstRowTreatmentCell).toContainText('*** BLINDED ***');

    // Click the "Unblinded" toggle
    const unblindedToggleLabel = page.locator('label').filter({ hasText: 'Blinded' }).or(page.locator('label').filter({ hasText: 'Unblinded' }));
    await unblindedToggleLabel.click();

    // Assert the text changes from "*** BLINDED ***"
    await expect(firstRowTreatmentCell).not.toContainText('*** BLINDED ***');
    // Should be something like High Dose, Low Dose, Placebo
    await expect(firstRowTreatmentCell).not.toBeEmpty();
  });
});
