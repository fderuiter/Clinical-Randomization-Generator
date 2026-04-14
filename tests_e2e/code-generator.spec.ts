import { test, expect } from '@playwright/test';

test.describe('Code Generator Modal UI', () => {
  test.beforeEach(async ({ page }) => {
    // Add an explicit listener for console errors to catch potential download issues
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
    await page.goto('http://localhost:4200/generator');
  });

  test('should generate, display, and download code in all three languages', async ({ page }) => {
    // Fill required form fields to enable code generation
    await page.getByLabel(/Protocol ID/i).fill('TEST-PRT-123');
    await page.getByLabel(/Study Name/i).fill('End-to-end Test Study');
    await page.locator('#phase').selectOption({ label: 'Phase II' });

    // Arm Name inputs - use stable data-testid to avoid placeholder ambiguity (card-based UI)
    const armInputs = page.getByTestId('arm-name-input');
    await expect(armInputs.first()).toBeVisible({ timeout: 10000 });
    await armInputs.first().fill('Placebo');

    // Ratio is now a stepper - verify it shows the default value of 1
    const ratioValue = page.locator('span.tabular-nums').first();
    await expect(ratioValue).toHaveText('1');

    // Fill Site Details (now a tag-input component).
    // The inner <input> placeholder is hidden when chips already exist, so scope via the "Sites" label.
    const siteInput = page.locator('label:has-text("Sites") + app-tag-input input');
    await expect(siteInput).toBeVisible();
    await siteInput.fill('Site-001');
    await siteInput.press('Enter');

    // Fill Block Size Details
    const blockInputs = page.locator('#blockSizesStr');
    await expect(blockInputs).toBeVisible();
    await blockInputs.fill('2');

    // Open Advanced Settings accordion to reveal the Seed input
    await page.getByRole('button', { name: /Advanced Settings/i }).click();

    // Fill Random Seed (required by code generator to avoid MissingSeedError)
    const seedInput = page.getByLabel(/Random Seed/i);
    await expect(seedInput).toBeVisible();
    await seedInput.fill('42');

    // Check "Generate Code" button is present and click to open dropdown
    const generateCodeBtn = page.getByRole('button', { name: /Generate Code/i });
    await expect(generateCodeBtn).toBeVisible();
    await generateCodeBtn.click();

    // Select R Script to open modal
    await page.getByRole('menuitem', { name: /R Script/i }).click();

    // Verify modal is open
    const modalHeading = page.getByRole('heading', { name: /Code Generator/i });
    await expect(modalHeading).toBeVisible();

    const modal = page.locator('div[role="dialog"]');

    // Verify R Code (Default tab)
    const rTab = modal.getByRole('button', { name: /^R$/i });
    await expect(rTab).toHaveClass(/border-indigo-500/);
    const generatedCode = modal.getByTestId('generated-code');
    await expect(generatedCode).toBeVisible({ timeout: 10000 });
    await expect(generatedCode).toContainText(/Randomization Schema Generation in R/i, { timeout: 10000 });
    await expect(generatedCode).toContainText(/Protocol:\s*TEST-PRT-123/i);

    const downloadBtn = modal.getByRole('button', { name: /Download/i }).first();
    await expect(downloadBtn).toBeVisible();

    const downloadPromiseR = page.waitForEvent('download', { timeout: 10000 });
    // Use evaluate instead of click to bypass pointer-events
    await downloadBtn.evaluate(node => node.click());
    const downloadR = await downloadPromiseR;
    expect(downloadR.suggestedFilename()).toBe('randomization_code.R');

    // Verify Python Code
    const pythonTab = modal.getByRole('button', { name: /Python/i });
    await pythonTab.evaluate(node => node.click());
    await expect(pythonTab).toHaveClass(/border-indigo-500/);
    await expect(generatedCode).toContainText(/Randomization Schema Generation in Python/i, { timeout: 10000 });

    const downloadPromisePy = page.waitForEvent('download', { timeout: 10000 });
    await downloadBtn.evaluate(node => node.click());
    const downloadPy = await downloadPromisePy;
    expect(downloadPy.suggestedFilename()).toBe('randomization_code.py');

    // Verify SAS Code
    const sasTab = modal.getByRole('button', { name: /SAS/i });
    await sasTab.evaluate(node => node.click());
    await expect(sasTab).toHaveClass(/border-indigo-500/);
    await expect(generatedCode).toContainText(/Randomization Schema Generation in SAS/i, { timeout: 10000 });

    const downloadPromiseSas = page.waitForEvent('download', { timeout: 10000 });
    await downloadBtn.evaluate(node => node.click());
    const downloadSas = await downloadPromiseSas;
    expect(downloadSas.suggestedFilename()).toBe('randomization_code.sas');

    // Close modal
    await modal.getByRole('button', { name: /Close/i }).evaluate(node => node.click());
    await expect(modalHeading).toBeHidden();
  });
});
