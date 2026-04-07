import { test, expect, Page } from '@playwright/test';

/**
 * Helper: navigate to the generator page and generate a schema using the
 * Complex (Multi-strata) preset, which reliably produces > 20 rows so that
 * the pagination controls are visible.
 */
async function generateComplexSchema(page: Page) {
  await page.goto('http://localhost:4200');

  const getStartedBtn = page.getByRole('link', { name: /Get Started/i });
  if (await getStartedBtn.isVisible()) {
    await getStartedBtn.click();
  }

  const complexPresetBtn = page.getByRole('button', { name: /Complex \(Multi-strata\)/i });
  await expect(complexPresetBtn).toBeVisible();
  await complexPresetBtn.click();

  const generateSchemaBtn = page.getByRole('button', { name: /Generate Schema/i });
  await expect(generateSchemaBtn).not.toBeDisabled();
  await generateSchemaBtn.click();

  await expect(page.locator('#results-section')).toBeVisible({ timeout: 10000 });
}

test.describe('Results Grid Operations', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
    await generateComplexSchema(page);
  });

  // ---------------------------------------------------------------------------
  // Basic grid rendering
  // ---------------------------------------------------------------------------
  test('should display the results grid with at least one data row', async ({ page }) => {
    const rows = page.locator('#results-section tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('should show protocol ID and seed in the results header', async ({ page }) => {
    const header = page.locator('#results-section').first();
    await expect(header.getByText(/Protocol:/i)).toBeVisible();
    await expect(header.getByText(/Seed:/i)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Blinding toggle
  // ---------------------------------------------------------------------------
  test('should start in the blinded state', async ({ page }) => {
    const firstRowTreatmentCell = page
      .locator('#results-section tbody tr')
      .first()
      .locator('td')
      .last();
    await expect(firstRowTreatmentCell).toContainText('*** BLINDED ***');
  });

  test('should reveal treatment arms after clicking the blinding toggle', async ({ page }) => {
    const toggleLabel = page.locator('#results-section label').filter({ hasText: /Blinded|Unblinded/i });
    await toggleLabel.click();

    const firstRowTreatmentCell = page
      .locator('#results-section tbody tr')
      .first()
      .locator('td')
      .last();
    await expect(firstRowTreatmentCell).not.toContainText('*** BLINDED ***');
    await expect(firstRowTreatmentCell).not.toBeEmpty();
  });

  test('should re-blind the schema when the toggle is clicked a second time', async ({ page }) => {
    const toggleLabel = page.locator('#results-section label').filter({ hasText: /Blinded|Unblinded/i });
    const firstRowTreatmentCell = page
      .locator('#results-section tbody tr')
      .first()
      .locator('td')
      .last();

    await toggleLabel.click(); // unblind
    await expect(firstRowTreatmentCell).not.toContainText('*** BLINDED ***');

    await toggleLabel.click(); // re-blind
    await expect(firstRowTreatmentCell).toContainText('*** BLINDED ***');
  });

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------
  test('"Previous" button should be disabled on the first page', async ({ page }) => {
    const prevBtn = page.locator('#results-section').getByRole('button', { name: /Previous/i });
    await expect(prevBtn).toBeDisabled();
  });

  test('clicking "Next" should enable the "Previous" button', async ({ page }) => {
    const resultsSection = page.locator('#results-section');
    const nextBtn = resultsSection.getByRole('button', { name: /Next/i });
    const prevBtn = resultsSection.getByRole('button', { name: /Previous/i });

    // The Complex preset reliably produces > 20 rows; assert Next is enabled
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
    await expect(prevBtn).toBeEnabled();
  });

  test('clicking "Previous" after "Next" should return to the first page', async ({ page }) => {
    const resultsSection = page.locator('#results-section');
    const nextBtn = resultsSection.getByRole('button', { name: /Next/i });
    const prevBtn = resultsSection.getByRole('button', { name: /Previous/i });

    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
    await expect(prevBtn).toBeEnabled();
    await prevBtn.click();
    await expect(prevBtn).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // CSV export
  // ---------------------------------------------------------------------------
  test('should trigger a CSV download when the CSV button is clicked', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    const csvButton = page.locator('#results-section').getByRole('button', { name: /CSV/i });
    // Use evaluate to bypass any CSS pointer-events: none
    await csvButton.evaluate((node: HTMLElement) => node.click());
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/randomization_.*\.csv$/);
  });

  test('CSV filename should contain "blinded" when the schema is blinded', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    const csvButton = page.locator('#results-section').getByRole('button', { name: /CSV/i });
    await csvButton.evaluate((node: HTMLElement) => node.click());
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('blinded');
  });

  // ---------------------------------------------------------------------------
  // PDF export
  // ---------------------------------------------------------------------------
  test('should trigger a PDF download when the PDF button is clicked', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    const pdfButton = page.locator('#results-section').getByRole('button', { name: /PDF/i });
    await pdfButton.evaluate((node: HTMLElement) => node.click());
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/randomization_.*\.pdf$/);
  });
});
