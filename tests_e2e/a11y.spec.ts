import { test, expect } from '@playwright/test';
import { checkA11y } from './a11y';
import { generateSchemaFromPreset, openGenerator } from './generator-helpers';

test.describe('Accessibility (WCAG 2.1 AA)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
  });

  test('Landing page should have no critical/serious accessibility violations', async ({ page }) => {
    await page.goto('http://localhost:4200');
    await expect(page.getByRole('heading', { name: /Equipose/i })).toBeVisible();
    await checkA11y(page);
    await expect(page).toHaveScreenshot('landing-page-light.png', { fullPage: true });
  });

  test('About page should have no critical/serious accessibility violations', async ({ page }) => {
    await page.goto('http://localhost:4200/about');
    await expect(page.getByRole('heading', { name: /About Equipose/i })).toBeVisible();
    await checkA11y(page);
    await expect(page).toHaveScreenshot('about-page-light.png', { fullPage: true });
  });

  test('Generator page (configuration wizard) should have no critical/serious accessibility violations', async ({ page }) => {
    await openGenerator(page);
    await page.getByRole('button', { name: /^Complex$/i }).waitFor({ state: 'visible' });
    await checkA11y(page);
    await expect(page).toHaveScreenshot('generator-page-light.png', { fullPage: true });
  });

  test('Results grid should have no critical/serious accessibility violations after schema generation', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Complex');
    await checkA11y(page, '#results-section');
    await expect(page).toHaveScreenshot('results-grid-light.png', { fullPage: true });
  });

  test('Form validation errors should have no critical/serious accessibility violations', async ({ page }) => {
    await openGenerator(page);
    await page.getByRole('button', { name: /^Simple$/i }).click();

    // Trigger block sizes form validation error
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /^Next$/i }).click();
    }

    await page.locator('#blockSizesStr').clear();
    await page.locator('#blockSizesStr').fill('3');
    await page.locator('#blockSizesStr').press('Tab');

    await expect(page.getByText(/Block sizes must be multiples of total ratio/i)).toBeVisible();

    await checkA11y(page);
    await expect(page).toHaveScreenshot('form-validation-light.png', { fullPage: true });
  });

  test('Modals should have no critical/serious accessibility violations', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Simple');
    await page.getByRole('button', { name: /Generate Code/i }).click();
    await page.getByRole('menuitem', { name: /SAS Script/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await checkA11y(page);
    await expect(page).toHaveScreenshot('modal-light.png');
  });
});


test.describe('Accessibility (WCAG 2.1 AA) - Dark Mode', () => {
  test.use({ colorScheme: 'dark' });

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));

    // Evaluate to force dark mode in local storage to ensure the app picks it up
    await page.addInitScript(() => {
      localStorage.setItem('theme-preference', 'Dark');
    });
  });

  test('Landing page should have no critical/serious accessibility violations in dark mode', async ({ page }) => {
    await page.goto('http://localhost:4200');
    await expect(page.getByRole('heading', { name: /Equipose/i })).toBeVisible();

    // Explicitly add the dark class since playwright colorScheme doesn't always trigger Angular/Tailwind correctly immediately
    await page.evaluate(() => document.documentElement.classList.add('dark'));

    await checkA11y(page);
    await expect(page).toHaveScreenshot('landing-page-dark.png', { fullPage: true });
  });

  test('About page should have no critical/serious accessibility violations in dark mode', async ({ page }) => {
    await page.goto('http://localhost:4200/about');
    await expect(page.getByRole('heading', { name: /About Equipose/i })).toBeVisible();
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await checkA11y(page);
    await expect(page).toHaveScreenshot('about-page-dark.png', { fullPage: true });
  });

  test('Generator page (configuration wizard) should have no critical/serious accessibility violations in dark mode', async ({ page }) => {
    await openGenerator(page);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.getByRole('button', { name: /^Complex$/i }).waitFor({ state: 'visible' });
    await checkA11y(page);
    await expect(page).toHaveScreenshot('generator-page-dark.png', { fullPage: true });
  });

  test('Results grid should have no critical/serious accessibility violations after schema generation in dark mode', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Complex');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await checkA11y(page, '#results-section');
    await expect(page).toHaveScreenshot('results-grid-dark.png', { fullPage: true });
  });

  test('Form validation errors should have no critical/serious accessibility violations in dark mode', async ({ page }) => {
    await openGenerator(page);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.getByRole('button', { name: /^Simple$/i }).click();

    // Trigger block sizes form validation error
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /^Next$/i }).click();
    }

    await page.locator('#blockSizesStr').clear();
    await page.locator('#blockSizesStr').fill('3');
    await page.locator('#blockSizesStr').press('Tab');

    await expect(page.getByText(/Block sizes must be multiples of total ratio/i)).toBeVisible();

    await checkA11y(page);
    await expect(page).toHaveScreenshot('form-validation-dark.png', { fullPage: true });
  });

  test('Modals should have no critical/serious accessibility violations in dark mode', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Simple');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.getByRole('button', { name: /Generate Code/i }).click();
    await page.getByRole('menuitem', { name: /SAS Script/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await checkA11y(page);
    await expect(page).toHaveScreenshot('modal-dark.png');
  });
});
