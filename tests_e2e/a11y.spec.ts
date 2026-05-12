import { test, expect, Locator, Page } from '@playwright/test';
import { checkA11y } from './a11y';
import { generateSchemaFromPreset, goToStep, loadPreset, openGenerator } from './generator-helpers';

const screenshotOptions = { fullPage: true, maxDiffPixels: 200 } as const;
const resultsScreenshotOptions = { fullPage: true, maxDiffPixels: 2000 } as const;

async function applyDarkMode(page: Page): Promise<void> {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
}

async function assertLandingVisible(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /Equipose/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Get started/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Learn more/i })).toBeVisible();
}

async function assertGeneratorVisible(page: Page): Promise<void> {
  await expect(page.getByTestId('generator-page')).toBeVisible();
  await expect(page.locator('#protocolId')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Simple$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Standard$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Complex$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Next$/i })).toBeVisible();
}

async function assertSelectReadableStyling(select: Locator): Promise<void> {
  await expect(select).toBeVisible();
  const styleState = await select.evaluate((element) => {
    const classes = Array.from(element.classList);
    const style = window.getComputedStyle(element as HTMLElement);
    return {
      classes,
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      borderStyle: style.borderStyle,
    };
  });

  expect(styleState.classes).toContain('app-select-scheme');
  expect(styleState.color).not.toBe(styleState.backgroundColor);
  expect(styleState.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(styleState.borderStyle).not.toBe('none');
}

async function assertInputAndButtonReadable(input: Locator, button: Locator): Promise<void> {
  await expect(input).toBeVisible();
  await expect(button).toBeVisible();

  const inputStyle = await input.evaluate((element) => {
    const style = window.getComputedStyle(element as HTMLElement);
    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      borderStyle: style.borderStyle,
    };
  });
  expect(inputStyle.color).not.toBe(inputStyle.backgroundColor);
  expect(inputStyle.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(inputStyle.borderStyle).not.toBe('none');

  const buttonStyle = await button.evaluate((element) => {
    const style = window.getComputedStyle(element as HTMLElement);
    return {
      borderRadius: style.borderRadius,
    };
  });
  expect(buttonStyle.borderRadius).not.toBe('0px');
}

async function runTransientStateChecks(page: Page, mode: 'light' | 'dark'): Promise<void> {
  await openGenerator(page);
  if (mode === 'dark') await applyDarkMode(page);

  await loadPreset(page, 'Simple');
  await assertInputAndButtonReadable(page.locator('#protocolId'), page.getByRole('button', { name: /^Next$/i }).first());
  await assertSelectReadableStyling(page.locator('#phase'));
  await expect(page.locator('#protocolId')).toHaveScreenshot(`input-protocol-${mode}.png`, { maxDiffPixels: 100 });
  await expect(page.getByRole('button', { name: /^Next$/i }).first()).toHaveScreenshot(`button-next-${mode}.png`, { maxDiffPixels: 100 });
  await goToStep(page, 4);
  await page.getByRole('button', { name: /\+ Add Override/i }).click();
  const targetTypeSelect = page.locator('[formcontrolname="targetType"]').first();
  const targetIdSelect = page.locator('[formcontrolname="targetId"]').first();
  await assertSelectReadableStyling(targetTypeSelect);
  await assertSelectReadableStyling(targetIdSelect);
  await expect(targetTypeSelect).toHaveScreenshot(`dropdown-target-type-${mode}.png`, { maxDiffPixels: 100 });
  await expect(targetIdSelect).toHaveScreenshot(`dropdown-target-id-${mode}.png`, { maxDiffPixels: 100 });
  await expect(page.locator('#blockSizesStr')).toBeVisible();
  await page.locator('#blockSizesStr').fill('3');
  await page.locator('#blockSizesStr').press('Tab');
  await expect(page.getByText(/Block sizes must be multiples of total ratio/i)).toBeVisible();
  await checkA11y(page, '#blockSizesStr');
  await expect(page).toHaveScreenshot(`generator-validation-${mode}.png`, screenshotOptions);
  await page.locator('#blockSizesStr').fill('4');
  await page.locator('#blockSizesStr').press('Tab');
  await expect(page.getByRole('button', { name: /^Next$/i })).toBeEnabled();

  await page.getByRole('button', { name: /^Next$/i }).first().click();
  await page.getByRole('button', { name: /^Next$/i }).first().click();
  await expect(page.getByRole('button', { name: /Run Statistical QA/i })).toBeVisible();
  await page.getByRole('button', { name: /Generate Code/i }).click();
  await expect(page.getByRole('menuitem', { name: /R Script/i })).toBeVisible();
  await page.getByRole('menuitem', { name: /R Script/i }).click();
  const modal = page.locator('div[role="dialog"]');
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId('generated-code')).toBeVisible();
  await checkA11y(page, 'div[role="dialog"]');
  await expect(page).toHaveScreenshot(`code-generator-modal-${mode}.png`, screenshotOptions);
  await modal.getByRole('button', { name: /Close/i }).first().click();
  await expect(modal).toBeHidden();

  await page.getByRole('button', { name: /Generate Schema/i }).click();
  const resultsSection = page.locator('#results-section');
  await expect(resultsSection).toBeVisible();
  await page.evaluate(() => {
    const configFormElement = document.querySelector('app-config-form');
    const configFormComponent = (window as { ng?: { getComponent?: (node: Element | null) => unknown } }).ng
      ?.getComponent?.(configFormElement);
    const maybeToastService = (configFormComponent as { toastService?: { showError: (message: string) => void } } | undefined)?.toastService;
    maybeToastService?.showError('Contrast validation toast state');
  });
  const toast = page.locator('div[role="alert"]').first();
  await expect(toast).toBeVisible();
  await checkA11y(page, 'div[role="alert"]');
  await expect(toast).toHaveScreenshot(`toast-state-${mode}.png`, { maxDiffPixels: 200 });
}

async function runThemeCoverage(page: Page, mode: 'light' | 'dark'): Promise<void> {
  await page.goto('http://localhost:4200');
  if (mode === 'dark') await applyDarkMode(page);
  await assertLandingVisible(page);
  await checkA11y(page);
  await expect(page).toHaveScreenshot(`landing-${mode}.png`, screenshotOptions);

  await page.goto('http://localhost:4200/about');
  if (mode === 'dark') await applyDarkMode(page);
  await expect(page.getByRole('heading', { name: /About Equipose/i })).toBeVisible();
  await expect(page.getByTestId('feature-custom-ratios')).toBeVisible();
  await expect(page.getByTestId('feature-stratified-block')).toBeVisible();
  await expect(page.getByTestId('feature-code-generation')).toBeVisible();
  await checkA11y(page);
  await expect(page).toHaveScreenshot(`about-${mode}.png`, screenshotOptions);

  await openGenerator(page);
  if (mode === 'dark') await applyDarkMode(page);
  await assertGeneratorVisible(page);
  await checkA11y(page);
  await expect(page).toHaveScreenshot(`generator-${mode}.png`, screenshotOptions);

  await generateSchemaFromPreset(page, 'Complex');
  if (mode === 'dark') await applyDarkMode(page);
  const resultsSection = page.locator('#results-section');
  await expect(resultsSection).toBeVisible();
  await expect(resultsSection.getByRole('button', { name: /CSV/i })).toBeVisible();
  await expect(resultsSection.getByRole('button', { name: /Excel/i })).toBeVisible();
  await expect(resultsSection.getByRole('button', { name: /PDF/i })).toBeVisible();
  await expect(resultsSection.getByRole('button', { name: /JSON/i })).toBeVisible();
  await expect(resultsSection.locator('[data-testid="audit-hash-value"]')).toBeVisible();
  await expect(resultsSection.locator('[data-testid="result-row"]').first()).toBeVisible();
  await checkA11y(page, '#results-section');
  await expect(page).toHaveScreenshot(`results-grid-${mode}.png`, resultsScreenshotOptions);
}

test.describe('Accessibility and visual regression - light mode', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
  });

  test('pages should pass accessibility, visibility, and screenshot baselines', async ({ page }) => {
    await runThemeCoverage(page, 'light');
  });

  test('transient states should remain visible and accessible', async ({ page }) => {
    await runTransientStateChecks(page, 'light');
  });
});

test.describe('Accessibility and visual regression - dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
    await page.addInitScript(() => {
      localStorage.setItem('theme-preference', 'Dark');
    });
  });

  test('pages should pass accessibility, visibility, and screenshot baselines', async ({ page }) => {
    await runThemeCoverage(page, 'dark');
  });

  test('transient states should remain visible and accessible', async ({ page }) => {
    await runTransientStateChecks(page, 'dark');
  });
});
