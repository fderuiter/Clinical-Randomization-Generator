import { test, expect } from '@playwright/test';
import { openGenerator, loadPreset } from './generator-helpers';

test.describe('Determinism Test Suite', () => {
  test('generates identical Audit Hash for the same seed across Chromium, WebKit, and Firefox', async ({ page }) => {
    test.setTimeout(60000);

    await openGenerator(page);
    await loadPreset(page, 'Complex');

    await page.fill('input#protocolId', 'DET-100');
    await page.locator('input#subjectIdMask').clear();
    await page.fill('input#subjectIdMask', 'DET-{SEQ:3}');
    
    await page.fill('input#seed', 'deterministic-seed-2026');
    await page.keyboard.press('Tab');
    await page.locator("button:has-text('Next'):visible").first().click();

    await page.getByRole('radio', { name: 'Minimization' }).click();

    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Increase ratio for Low Dose' }).click();
    }
    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: 'Increase ratio for Placebo' }).click();
    }
    await page.locator("button:has-text('Next'):visible").first().click();

    await page.fill('input[id="levelDistage_<65"]', '50');
    await page.fill('input[id="levelDistage_>=65"]', '50');
    await page.fill('input[id="levelDistgender_M"]', '50');
    await page.fill('input[id="levelDistgender_F"]', '50');
    await page.fill('input[id="levelDistregion_NA"]', '50');
    await page.fill('input[id="levelDistregion_EU"]', '50');
    await page.keyboard.press('Tab');
    
    await expect(page.locator("button:has-text('Next'):visible").first()).toBeEnabled();
    await page.locator("button:has-text('Next'):visible").first().click();

    await page.fill('input#baseProbability', '0.8');
    await page.fill('input#totalSampleSize', '100');
    await expect(page.locator("button:has-text('Next'):visible").first()).toBeEnabled();
    await page.locator("button:has-text('Next'):visible").first().click();

    await page.getByRole('radio', { name: 'Marginal Only' }).click();
    await page.fill('input[id="age-margcap-<65"]', '80');
    await page.fill('input[id="age-margcap->=65"]', '80');
    await expect(page.locator("button:has-text('Next'):visible").first()).toBeEnabled();
    await page.locator("button:has-text('Next'):visible").first().click();

    await page.getByRole('button', { name: /Generate Schema/i }).click();

    const resultsSection = page.locator('#results-section');
    await expect(resultsSection).toBeVisible({ timeout: 15000 });

    const auditHashElement = page.locator('[data-testid="audit-hash-value"]');
    await expect(auditHashElement).toBeVisible();

    const hash = await auditHashElement.innerText();
    console.log(`Generated Hash: ${hash}`);
    
    expect(hash).toBe('9989a854990a...58d99df25c68');
  });
});
