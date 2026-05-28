import { test, expect, Page } from '@playwright/test';
import { generateSchemaFromPreset } from './generator-helpers';

/**
 * Helper: navigate to the generator page and generate a schema using the
 * Complex (Multi-strata) preset, which reliably produces many rows for
 * virtual-scroll verification.
 */
async function generateComplexSchema(page: Page) {
  await generateSchemaFromPreset(page, 'Complex');
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
    const toggleLabel = page.locator('#results-section button[role="switch"]');
    await toggleLabel.click();

    const firstRow = page.locator('[data-testid="result-row"]').first();
    const armCell = firstRow.locator('[data-testid="result-arm-cell"]');
    await expect(armCell).not.toContainText('*** BLINDED ***');
    await expect(armCell).not.toBeEmpty();
  });

  test('should re-blind the schema when the toggle is clicked a second time', async ({ page }) => {
    const toggleLabel = page.locator('#results-section button[role="switch"]');
    const firstRow = page.locator('[data-testid="result-row"]').first();
    const armCell = firstRow.locator('[data-testid="result-arm-cell"]');

    await toggleLabel.click(); // unblind
    await expect(armCell).not.toContainText('*** BLINDED ***');

    await toggleLabel.click(); // re-blind
    await expect(armCell).toContainText('*** BLINDED ***');
  });

  // ---------------------------------------------------------------------------
  // Export Compliance Bundle
  // ---------------------------------------------------------------------------
  test('should require saving a version before exporting compliance bundle', async ({ page }) => {
    // Attempting to export directly should fail or be replaced by Save Version
    const saveVersionBtn = page.locator('#results-section').getByRole('button', { name: /Save Version/i });
    await expect(saveVersionBtn).toBeVisible();

    // Click save version to open modal
    await saveVersionBtn.click();
    await page.getByPlaceholder('e.g. JDOE').fill('TEST_OP');
    await page.getByPlaceholder('Describe what changed and why...').fill('Initial setup');
    await page.getByRole('button', { name: 'Save Version', exact: true }).click();

    // Now export bundle should be available
    const exportBundleBtn = page.locator('#results-section').getByRole('button', { name: /Export Compliance Bundle/i });
    await expect(exportBundleBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await exportBundleBtn.evaluate((node: HTMLElement) => node.click());
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/compliance_bundle_.*\.zip$/);
  });
});
