import { expect, Page } from '@playwright/test';

export async function openGenerator(page: Page): Promise<void> {
  await page.goto('http://localhost:4200/generator');
  await expect(page.getByTestId('generator-page')).toBeVisible();
  await expect(page.locator('form')).toBeVisible();
}

export async function loadPreset(page: Page, preset: 'Simple' | 'Standard' | 'Complex'): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${preset}$`, 'i') }).click();
}

export async function goToReviewStep(page: Page): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: /^Next$/i }).click();
  }
  await expect(page.getByRole('button', { name: /Run Statistical QA/i })).toBeVisible();
}

export async function generateSchemaFromPreset(page: Page, preset: 'Simple' | 'Standard' | 'Complex' = 'Complex'): Promise<void> {
  await openGenerator(page);
  await loadPreset(page, preset);
  await goToReviewStep(page);
  await page.getByRole('button', { name: /Generate Schema/i }).click();
  await expect(page.locator('#results-section')).toBeVisible({ timeout: 15000 });
}
