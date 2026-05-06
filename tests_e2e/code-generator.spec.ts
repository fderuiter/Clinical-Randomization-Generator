import { test, expect } from '@playwright/test';
import { openGenerator } from './generator-helpers';

test.describe('Code Generator Modal UI', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
    await openGenerator(page);
  });

  test('should generate, display, and download code in R, Python, and SAS', async ({ page }) => {
    await page.locator('#protocolId').fill('TEST-PRT-123');
    await page.locator('#studyName').fill('End-to-end Test Study');
    await page.locator('#phase').selectOption({ label: 'Phase II' });

    await page.getByRole('button', { name: /^Next$/i }).click();
    await page.locator('#armName0').fill('Placebo');
    await page.getByRole('button', { name: /^Next$/i }).click();

    const siteInput = page.locator('#sitesLabel + app-tag-input input');
    await expect(siteInput).toBeVisible();
    await siteInput.fill('Site-001');
    await siteInput.press('Enter');
    await page.getByRole('button', { name: /^Next$/i }).click();

    await page.locator('#blockSizesStr').fill('2');
    await page.getByRole('button', { name: /^Next$/i }).click();
    await page.getByRole('button', { name: /^Next$/i }).click();

    const generateCodeBtn = page.getByRole('button', { name: /Generate Code/i });
    await expect(generateCodeBtn).toBeVisible();
    await generateCodeBtn.click();
    await page.getByRole('menuitem', { name: /R Script/i }).click();

    const modalHeading = page.getByRole('heading', { name: /Code Generator/i });
    await expect(modalHeading).toBeVisible();
    const modal = page.locator('div[role="dialog"]');
    const generatedCode = modal.getByTestId('generated-code');
    await expect(generatedCode).toContainText(/Protocol:\s*TEST-PRT-123/i);

    const downloadBtn = modal.getByRole('button', { name: /Download/i }).first();
    const downloadPromiseR = page.waitForEvent('download', { timeout: 10000 });
    await downloadBtn.click();
    const downloadR = await downloadPromiseR;
    expect(downloadR.suggestedFilename()).toBe('randomization_schema.R');

    const pythonTab = modal.getByRole('button', { name: /Python/i });
    await pythonTab.click();
    await expect(generatedCode).toContainText(/Randomization Schema Generation in Python/i, { timeout: 10000 });
    const downloadPromisePy = page.waitForEvent('download', { timeout: 10000 });
    await downloadBtn.click();
    const downloadPy = await downloadPromisePy;
    expect(downloadPy.suggestedFilename()).toBe('randomization_schema.py');

    const sasTab = modal.getByRole('button', { name: /SAS/i });
    await sasTab.click();
    await expect(generatedCode).toContainText(/Randomization Schema Generation in SAS/i, { timeout: 10000 });
    const downloadPromiseSas = page.waitForEvent('download', { timeout: 10000 });
    await downloadBtn.click();
    const downloadSas = await downloadPromiseSas;
    expect(downloadSas.suggestedFilename()).toBe('randomization_schema.sas');

    await modal.getByRole('button', { name: /Close/i }).first().click();
    await expect(modalHeading).toBeHidden();
  });
});
