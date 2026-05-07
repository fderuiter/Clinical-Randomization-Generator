import { expect, Page } from '@playwright/test';

const FIRST_WIZARD_STEP = 1;
const REVIEW_WIZARD_STEP = 6;

export async function openGenerator(page: Page): Promise<void> {
  await page.goto('http://localhost:4200/generator');
  await expect(page.getByTestId('generator-page')).toBeVisible();
  await expect(page.locator('form')).toBeVisible();
}

export async function loadPreset(page: Page, preset: 'Simple' | 'Standard' | 'Complex'): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${preset}$`, 'i') }).click();
}

/**
 * Navigate forward to a wizard step using 1-based numbering.
 * Valid values map to the 6-step generator wizard (1 = Setup, 6 = Review).
 */
export async function goToStep(page: Page, step: number): Promise<void> {
  for (let i = 0; i < Math.max(0, step - FIRST_WIZARD_STEP); i++) {
    await page.getByRole('button', { name: /^Next$/i }).click();
  }
}

export async function goToReviewStep(page: Page): Promise<void> {
  await goToStep(page, REVIEW_WIZARD_STEP);
  await expect(page.getByRole('button', { name: /Run Statistical QA/i })).toBeVisible();
}

export async function goBackToFirstStep(page: Page): Promise<void> {
  for (let i = 0; i < Math.max(0, REVIEW_WIZARD_STEP - FIRST_WIZARD_STEP); i++) {
    await page.getByRole('button', { name: /^Previous$/i }).click();
  }
}

export async function generateSchemaFromPreset(page: Page, preset: 'Simple' | 'Standard' | 'Complex' = 'Complex'): Promise<void> {
  await openGenerator(page);
  await loadPreset(page, preset);
  await goToReviewStep(page);
  await page.getByRole('button', { name: /Generate Schema/i }).click();
  await expect(page.locator('#results-section')).toBeVisible({ timeout: 15000 });
}
