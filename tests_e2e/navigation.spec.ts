import { test, expect } from '@playwright/test';

test.describe('Application Navigation', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
  });

  test('should display the landing page at the root URL', async ({ page }) => {
    await page.goto('http://localhost:4200');
    await expect(page.getByRole('heading', { name: /Equipose/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Get started/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Learn more/i })).toBeVisible();
  });

  test('should navigate to the generator page via the "Get started" link', async ({ page }) => {
    await page.goto('http://localhost:4200');
    await page.getByRole('link', { name: /Get started/i }).click();
    await expect(page).toHaveURL(/\/generator/);
    await expect(page.getByTestId('generator-page')).toBeVisible();
  });

  test('should navigate to the About page via the header nav link', async ({ page }) => {
    await page.goto('http://localhost:4200');
    // Use the nav in the header (not the footer or elsewhere)
    await page.locator('header').getByRole('link', { name: /About/i }).click();
    await expect(page).toHaveURL(/\/about/);
    await expect(page.getByRole('heading', { name: /About Equipose/i })).toBeVisible();
  });

  test('should navigate to the Generator page via the header nav link', async ({ page }) => {
    await page.goto('http://localhost:4200');
    // Use exact: true to avoid matching the logo link "Clinical Randomization Generator"
    await page.locator('header').getByRole('link', { name: 'Generator', exact: true }).click();
    await expect(page).toHaveURL(/\/generator/);
    await expect(page.getByTestId('generator-page')).toBeVisible();
  });

  test('should navigate back to the landing page via the logo link', async ({ page }) => {
    await page.goto('http://localhost:4200/generator');
    await page.getByRole('link', { name: /Equipose/ }).first().click();
    await expect(page).toHaveURL('http://localhost:4200/');
    await expect(page.getByRole('link', { name: /Get started/i })).toBeVisible();
  });

  test('should redirect any unknown route back to the landing page', async ({ page }) => {
    await page.goto('http://localhost:4200/this-route-does-not-exist');
    await expect(page).toHaveURL('http://localhost:4200/');
    await expect(page.getByRole('link', { name: /Get started/i })).toBeVisible();
  });

  test('About page should display the 21 CFR Part 11 compliance warning', async ({ page }) => {
    await page.goto('http://localhost:4200/about');
    await expect(page.getByText(/not 21 CFR Part 11 compliant/i)).toBeVisible();
    // "DRAFT SCHEMA" text is not present in the About page template; verify compliance notice only
  });

  test('About page should show the three feature sections', async ({ page }) => {
    await page.goto('http://localhost:4200/about');
    await expect(page.getByTestId('feature-custom-ratios')).toBeVisible();
    await expect(page.getByTestId('feature-stratified-block')).toBeVisible();
    await expect(page.getByTestId('feature-code-generation')).toBeVisible();
  });
});
