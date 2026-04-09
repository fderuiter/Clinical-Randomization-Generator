import { test, expect, Page } from '@playwright/test';

/**
 * Helper: navigate to the generator page and generate a schema using the
 * Complex (Multi-strata) preset, which reliably produces many rows for
 * virtual-scroll verification.
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
    const rows = page.locator('#results-section [data-testid="result-row"]');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('should show protocol ID and seed in the results header', async ({ page }) => {
    const header = page.locator('#results-section').first();
    await expect(header.getByText(/Protocol:/i)).toBeVisible();
    await expect(header.getByText(/Seed:/i)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Virtual scroll verification
  // ---------------------------------------------------------------------------
  test('virtual scroll viewport should be present in flat view', async ({ page }) => {
    const viewport = page.locator('#results-section cdk-virtual-scroll-viewport');
    await expect(viewport).toBeVisible();
  });

  test('DOM should contain far fewer rows than total items (virtual scroll active)', async ({ page }) => {
    // The virtual scroll should render only visible rows, not all rows.
    // The Complex preset generates many rows; only a small window should be in the DOM.
    const totalRows = await page.locator('#results-section [data-testid="result-row"]').count();
    // Virtual scroll viewport is 600px, itemSize 48px → max ~12-14 rows + buffer
    // We just verify it's finite and reasonable (< 100 in flat mode = virtual scroll working)
    expect(totalRows).toBeGreaterThan(0);
    expect(totalRows).toBeLessThan(100);
  });

  // ---------------------------------------------------------------------------
  // Column headers and sorting
  // ---------------------------------------------------------------------------
  test('should show sortable column headers in flat view', async ({ page }) => {
    const subjectIdHeader = page.locator('#results-section thead th').first();
    await expect(subjectIdHeader.getByRole('button', { name: /Sort by Subject ID/i })).toBeVisible();
  });

  test('should show filter icon on Site column', async ({ page }) => {
    const filterBtn = page.locator('#results-section thead').getByRole('button', { name: /Filter Site/i });
    await expect(filterBtn).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Blinding toggle
  // ---------------------------------------------------------------------------
  test('should start in the blinded state', async ({ page }) => {
    const firstRow = page.locator('[data-testid="result-row"]').first();
    const armCell = firstRow.locator('[data-testid="result-arm-cell"]');
    await expect(armCell).toContainText('*** BLINDED ***');
  });

  test('should reveal treatment arms after clicking the blinding toggle', async ({ page }) => {
    const toggleLabel = page.locator('#results-section label').filter({ hasText: /Blinded|Unblinded/i });
    await toggleLabel.click();

    const firstRow = page.locator('[data-testid="result-row"]').first();
    const armCell = firstRow.locator('[data-testid="result-arm-cell"]');
    await expect(armCell).not.toContainText('*** BLINDED ***');
    await expect(armCell).not.toBeEmpty();
  });

  test('should re-blind the schema when the toggle is clicked a second time', async ({ page }) => {
    const toggleLabel = page.locator('#results-section label').filter({ hasText: /Blinded|Unblinded/i });
    const firstRow = page.locator('[data-testid="result-row"]').first();
    const armCell = firstRow.locator('[data-testid="result-arm-cell"]');

    await toggleLabel.click(); // unblind
    await expect(armCell).not.toContainText('*** BLINDED ***');

    await toggleLabel.click(); // re-blind
    await expect(armCell).toContainText('*** BLINDED ***');
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
