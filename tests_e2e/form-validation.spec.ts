import { test, expect } from '@playwright/test';

test.describe('Form Validation and Configuration', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
    await page.goto('http://localhost:4200/generator');
  });

  // ---------------------------------------------------------------------------
  // Preset loading
  // ---------------------------------------------------------------------------
  test('should load the Simple (Unstratified) preset with the correct protocol ID', async ({ page }) => {
    await page.getByRole('button', { name: /Simple \(Unstratified\)/i }).click();
    await expect(page.locator('#protocolId')).toHaveValue('SIMP-001');
  });

  test('Simple preset should produce an unstratified form (no strata rows)', async ({ page }) => {
    await page.getByRole('button', { name: /Simple \(Unstratified\)/i }).click();
    await expect(page.getByText(/No stratification factors defined/i)).toBeVisible();
  });

  test('should load the Standard (1 Stratum) preset with the correct protocol ID', async ({ page }) => {
    await page.getByRole('button', { name: /Standard \(1 Stratum\)/i }).click();
    await expect(page.locator('#protocolId')).toHaveValue('STD-002');
  });

  test('Standard preset should add exactly one stratum row', async ({ page }) => {
    await page.getByRole('button', { name: /Standard \(1 Stratum\)/i }).click();
    const strataRows = page.locator('[formArrayName="strata"] > div');
    await expect(strataRows).toHaveCount(1);
  });

  test('should load the Complex (Multi-strata) preset with the correct protocol ID', async ({ page }) => {
    await page.getByRole('button', { name: /Complex \(Multi-strata\)/i }).click();
    await expect(page.locator('#protocolId')).toHaveValue('CMPX-003');
  });

  test('Complex preset should add exactly three strata rows', async ({ page }) => {
    await page.getByRole('button', { name: /Complex \(Multi-strata\)/i }).click();
    const strataRows = page.locator('[formArrayName="strata"] > div');
    await expect(strataRows).toHaveCount(3);
  });

  // ---------------------------------------------------------------------------
  // Button disabled states
  // ---------------------------------------------------------------------------
  test('"Generate Schema" should be disabled when Protocol ID is cleared', async ({ page }) => {
    await page.locator('#protocolId').clear();
    await expect(page.getByRole('button', { name: /Generate Schema/i })).toBeDisabled();
  });

  test('"Generate Code" button should be disabled when Protocol ID is cleared', async ({ page }) => {
    await page.locator('#protocolId').clear();
    await expect(page.getByRole('button', { name: /Generate Code/i })).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // Block-size inline validation error
  // ---------------------------------------------------------------------------
  test('should display a validation error when a block size is not a multiple of the total ratio', async ({ page }) => {
    // Load Simple preset: 2 arms with ratio 1 each → total ratio = 2
    await page.getByRole('button', { name: /Simple \(Unstratified\)/i }).click();

    // 3 is not a multiple of 2 → should trigger the validator
    await page.locator('#blockSizesStr').clear();
    await page.locator('#blockSizesStr').fill('3');

    // Trigger re-validation by moving focus away
    await page.locator('#protocolId').click();

    await expect(page.getByText(/Block sizes must be multiples of the total treatment ratio/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate Schema/i })).toBeDisabled();
  });

  test('validation error should clear once a valid block size is entered', async ({ page }) => {
    await page.getByRole('button', { name: /Simple \(Unstratified\)/i }).click();

    await page.locator('#blockSizesStr').clear();
    await page.locator('#blockSizesStr').fill('3');
    await page.locator('#protocolId').click();
    await expect(page.getByText(/Block sizes must be multiples of the total treatment ratio/i)).toBeVisible();

    await page.locator('#blockSizesStr').clear();
    await page.locator('#blockSizesStr').fill('2');
    await page.locator('#protocolId').click();
    await expect(page.getByText(/Block sizes must be multiples of the total treatment ratio/i)).toBeHidden();
  });

  // ---------------------------------------------------------------------------
  // Arm management
  // ---------------------------------------------------------------------------
  test('should add a new arm row when "+ Add Arm" is clicked', async ({ page }) => {
    const armRows = page.locator('[formArrayName="arms"] > div');
    const initialCount = await armRows.count();

    await page.getByRole('button', { name: /\+ Add Arm/i }).click();

    await expect(armRows).toHaveCount(initialCount + 1);
  });

  // ---------------------------------------------------------------------------
  // Strata management
  // ---------------------------------------------------------------------------
  test('should add a new stratum row when "+ Add Factor" is clicked on an unstratified form', async ({ page }) => {
    await page.getByRole('button', { name: /Simple \(Unstratified\)/i }).click();
    await expect(page.getByText(/No stratification factors defined/i)).toBeVisible();

    await page.getByRole('button', { name: /\+ Add Factor/i }).click();
    const strataRows = page.locator('[formArrayName="strata"] > div');
    await expect(strataRows).toHaveCount(1);
  });

  test('should update the stratum caps table when stratum levels are entered', async ({ page }) => {
    await page.getByRole('button', { name: /Simple \(Unstratified\)/i }).click();
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
    // Blur to trigger Angular value-changes subscription
    await page.locator('#protocolId').click();

    const capRows = page.locator('[formArrayName="stratumCaps"] > div');
    await expect(capRows).toHaveCount(2, { timeout: 5000 });
  });
});
