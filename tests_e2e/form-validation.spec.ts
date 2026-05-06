import { test, expect } from '@playwright/test';
import { goToStep, loadPreset, openGenerator } from './generator-helpers';

test.describe('Form Validation and Configuration', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
    await openGenerator(page);
  });

  // ---------------------------------------------------------------------------
  // Preset loading
  // ---------------------------------------------------------------------------
  test('should load the Simple (Unstratified) preset with the correct protocol ID', async ({ page }) => {
    await loadPreset(page, 'Simple');
    await expect(page.locator('#protocolId')).toHaveValue('SIMP-001');
  });

  test('Simple preset should produce an unstratified form (no strata rows)', async ({ page }) => {
    await loadPreset(page, 'Simple');
    await goToStep(page, 3);
    await expect(page.getByText(/No stratification factors defined/i)).toBeVisible();
  });

  test('should load the Standard (1 Stratum) preset with the correct protocol ID', async ({ page }) => {
    await loadPreset(page, 'Standard');
    await expect(page.locator('#protocolId')).toHaveValue('STD-002');
  });

  test('Standard preset should add exactly one stratum row', async ({ page }) => {
    await loadPreset(page, 'Standard');
    await goToStep(page, 3);
    const strataRows = page.locator('[formArrayName="strata"] > div');
    await expect(strataRows).toHaveCount(1);
  });

  test('should load the Complex (Multi-strata) preset with the correct protocol ID', async ({ page }) => {
    await loadPreset(page, 'Complex');
    await expect(page.locator('#protocolId')).toHaveValue('CMPX-003');
  });

  test('Complex preset should add exactly three strata rows', async ({ page }) => {
    await loadPreset(page, 'Complex');
    await goToStep(page, 3);
    const strataRows = page.locator('[formArrayName="strata"] > div');
    await expect(strataRows).toHaveCount(3);
  });

  // ---------------------------------------------------------------------------
  // Button disabled states
  // ---------------------------------------------------------------------------
  test('"Generate Schema" should be disabled when Protocol ID is cleared', async ({ page }) => {
    await page.locator('#protocolId').clear();
    await expect(page.getByRole('button', { name: /^Next$/i })).toBeDisabled();
  });

  test('"Generate Code" button should be disabled when Protocol ID is cleared', async ({ page }) => {
    await page.locator('#protocolId').clear();
    await expect(page.getByRole('button', { name: /^Next$/i })).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // Block-size inline validation error
  // ---------------------------------------------------------------------------
  test('should display a validation error when a block size is not a multiple of the total ratio', async ({ page }) => {
    // Load Simple preset: 2 arms with ratio 1 each → total ratio = 2
    await loadPreset(page, 'Simple');
    await goToStep(page, 4);

    // 3 is not a multiple of 2 → should trigger the validator
    await page.locator('#blockSizesStr').clear();
    await page.locator('#blockSizesStr').fill('3');

    await page.locator('#blockSizesStr').press('Tab');

    await expect(page.getByText(/Block sizes must be multiples of total ratio/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Next$/i })).toBeDisabled();
  });

  test('validation error should clear once a valid block size is entered', async ({ page }) => {
    await loadPreset(page, 'Simple');
    await goToStep(page, 4);

    await page.locator('#blockSizesStr').clear();
    await page.locator('#blockSizesStr').fill('3');
    await page.locator('#blockSizesStr').press('Tab');
    await expect(page.getByText(/Block sizes must be multiples of total ratio/i)).toBeVisible();

    await page.locator('#blockSizesStr').clear();
    await page.locator('#blockSizesStr').fill('2');
    await page.locator('#blockSizesStr').press('Tab');
    await expect(page.getByText(/Block sizes must be multiples of total ratio/i)).toBeHidden();
  });

  // ---------------------------------------------------------------------------
  // Arm management
  // ---------------------------------------------------------------------------
  test('should add a new arm row when "+ Add Arm" is clicked', async ({ page }) => {
    await goToStep(page, 2);
    const armRows = page.locator('[formArrayName="arms"] > div');
    await expect(armRows).toHaveCount(2);

    await page.getByRole('button', { name: /\+ Add Arm/i }).click();

    await expect(armRows).toHaveCount(3);
  });

  // ---------------------------------------------------------------------------
  // Strata management
  // ---------------------------------------------------------------------------
  test('should add a new stratum row when "+ Add Factor" is clicked on an unstratified form', async ({ page }) => {
    await loadPreset(page, 'Simple');
    await goToStep(page, 3);
    await expect(page.getByText(/No stratification factors defined/i)).toBeVisible();

    await page.getByRole('button', { name: /\+ Add Factor/i }).click();
    const strataRows = page.locator('[formArrayName="strata"] > div');
    await expect(strataRows).toHaveCount(1);
  });

  test('should update the stratum caps table when stratum levels are entered', async ({ page }) => {
    await loadPreset(page, 'Simple');
    await goToStep(page, 3);
    await page.getByRole('button', { name: /\+ Add Factor/i }).click();

    // Wait for the new stratum row to be fully rendered
    const strataRows = page.locator('[formArrayName="strata"] > div');
    await expect(strataRows).toHaveCount(1, { timeout: 5000 });

    // Scope to the first stratum row and target the real <input> inside app-tag-input.
    // getByPlaceholder is avoided here because the placeholder attribute is also set on the
    // <app-tag-input> host element, causing Playwright to pick up the non-fillable host first.
    const firstStratumRow = strataRows.first();
    const levelsInput = firstStratumRow.locator('app-tag-input input').first();
    await levelsInput.waitFor({ state: 'visible', timeout: 10000 });
    await levelsInput.fill('Level1');
    await levelsInput.press('Enter');
    await levelsInput.fill('Level2');
    await levelsInput.press('Enter');
    await levelsInput.press('Tab');

    // Move from Step 3 (Sites & Stratification) to Step 5 (Enrollment Caps).
    await page.getByRole('button', { name: /^Next$/i }).click();
    await page.getByRole('button', { name: /^Next$/i }).click();
    const capRows = page.locator('[formArrayName="stratumCaps"] > div');
    await expect(capRows).toHaveCount(2, { timeout: 5000 });
  });
});
