import { test, expect } from '@playwright/test';

test.describe('Code Generator Modal UI', () => {
  test.beforeEach(async ({ page }) => {
    // Add an explicit listener for console errors to catch potential download issues
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
    await page.goto('http://localhost:4200');
  });

  test('should generate, display, and download code in all three languages', async ({ page }) => {
    // Navigate to generator page
    const getStartedBtn = page.getByRole('link', { name: /Get Started/i });
    if (await getStartedBtn.isVisible()) {
      await getStartedBtn.click();
    }

    // Fill required form fields to enable code generation
    await page.getByLabel(/Protocol ID/i).fill('TEST-PRT-123');
    await page.getByLabel(/Study Name/i).fill('End-to-end Test Study');
    await page.locator('#phase').selectOption({ label: 'Phase II' });

    // Fill Arm details
    const armInputs = page.getByPlaceholder(/Arm Name/i);
    await expect(armInputs.nth(0)).toBeVisible();
    await armInputs.nth(0).fill('Placebo');

    const ratioInputs = page.getByPlaceholder(/Ratio/i);
    await expect(ratioInputs.nth(0)).toBeVisible();
    await ratioInputs.nth(0).fill('1');

    // Fill Site Details
    const siteInputs = page.locator('#sitesStr');
    await expect(siteInputs).toBeVisible();
    await siteInputs.fill('Site-001');

    // Fill Block Size Details
    const blockInputs = page.locator('#blockSizesStr');
    await expect(blockInputs).toBeVisible();
    await blockInputs.fill('2');

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
    const codeBlock = modal.locator('pre code');
    await expect(codeBlock).toContainText('Randomization Schema Generation in R');
    await expect(codeBlock).toContainText('Protocol: TEST-PRT-123');

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
    await expect(codeBlock).toContainText('Randomization Schema Generation in Python');

    const downloadPromisePy = page.waitForEvent('download', { timeout: 10000 });
    await downloadBtn.evaluate(node => node.click());
    const downloadPy = await downloadPromisePy;
    expect(downloadPy.suggestedFilename()).toBe('randomization_code.py');

    // Verify SAS Code
    const sasTab = modal.getByRole('button', { name: /SAS/i });
    await sasTab.evaluate(node => node.click());
    await expect(sasTab).toHaveClass(/border-indigo-500/);
    await expect(codeBlock).toContainText('Randomization Schema Generation in SAS');

    const downloadPromiseSas = page.waitForEvent('download', { timeout: 10000 });
    await downloadBtn.evaluate(node => node.click());
    const downloadSas = await downloadPromiseSas;
    expect(downloadSas.suggestedFilename()).toBe('randomization_code.sas');

    // Close modal
    await modal.getByRole('button', { name: /Close/i }).evaluate(node => node.click());
    await expect(modalHeading).toBeHidden();
  });
});
