import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: navigate to the generator page and ensure the form is ready
// ---------------------------------------------------------------------------
async function navigateToGenerator(page: Page) {
  await page.goto('http://localhost:4200');
  const getStartedBtn = page.getByRole('link', { name: /Get Started/i });
  if (await getStartedBtn.isVisible()) {
    await getStartedBtn.click();
  }
  // Wait for the config form to be visible
  await expect(page.locator('form')).toBeVisible();
}

test.describe('Monte Carlo Statistical Validation', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', err => console.log(`Page Error: ${err.message}`));
    await navigateToGenerator(page);
  });

  // ── Button presence & enabled state ───────────────────────────────────────

  test('should display the "Run Statistical QA" button on the generator page', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await expect(mcBtn).toBeVisible();
  });

  test('"Run Statistical QA" button should be disabled when form is invalid (Protocol ID cleared)', async ({ page }) => {
    await page.locator('#protocolId').clear();
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await expect(mcBtn).toBeDisabled();
  });

  test('"Run Statistical QA" button should be enabled when form is valid (default state)', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await expect(mcBtn).toBeEnabled();
  });

  // ── Modal opening ─────────────────────────────────────────────────────────

  test('clicking "Run Statistical QA" should open the Monte Carlo validation modal', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const modalTitle = page.getByRole('heading', { name: /Statistical QA.*Monte Carlo Validation/i });
    await expect(modalTitle).toBeVisible();
  });

  test('modal should show the seed disclaimer banner immediately', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // The amber disclaimer about seed stripping
    await expect(modal.getByText(/PRNG seed has been stripped/i)).toBeVisible();
    await expect(modal.getByTestId('seed-disclaimer-banner')).toBeVisible();
  });

  // ── Progress bar ──────────────────────────────────────────────────────────

  test('modal should show the progress bar when simulation starts', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Progress bar should appear while running
    const progressBar = modal.getByTestId('mc-progress-bar');
    await expect(progressBar).toBeVisible({ timeout: 5000 });
  });

  test('modal should show "Simulating trials" text during simulation', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // At least transiently the "Simulating trials" text appears
    await expect(modal.getByText(/Simulating trials/i)).toBeVisible({ timeout: 5000 });
  });

  test('modal should show subtitle about 10,000 independent simulations', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText(/10,000 independent trial simulations/i)).toBeVisible();
  });

  // ── Simulation completion ─────────────────────────────────────────────────

  test('simulation should complete and show the validation report', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Wait for simulation to complete: "Simulating trials…" goes away
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 30000 });

    // The chart should now be visible
    const chart = modal.getByTestId('mc-chart');
    await expect(chart).toBeVisible({ timeout: 5000 });
  });

  test('completed report should display "Simulations Run" summary stat', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 30000 });

    await expect(modal.getByText(/Simulations Run/i)).toBeVisible();
    // Should show 10,000
    await expect(modal.getByTestId('simulations-run-value')).toHaveText('10,000');
  });

  test('completed report should display "Total Subjects Simulated" summary stat', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 30000 });

    await expect(modal.getByText(/Total Subjects Simulated/i)).toBeVisible();
  });

  test('completed report should display "Max Arm Deviation" stat', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 30000 });

    await expect(modal.getByText(/Max Arm Deviation/i)).toBeVisible();
  });

  test('completed report should display the arm distribution bar chart', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 30000 });

    const chart = modal.getByTestId('mc-chart');
    await expect(chart).toBeVisible();

    // Chart should contain Expected/Actual bar labels
    await expect(chart.getByText(/Expected/i).first()).toBeVisible();
    await expect(chart.getByText(/Actual/i).first()).toBeVisible();
  });

  test('completed report should display a per-arm detail table', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 30000 });

    // Detail table should have headers
    await expect(modal.getByRole('columnheader', { name: /Arm/i })).toBeVisible();
    await expect(modal.getByRole('columnheader', { name: /Ratio/i })).toBeVisible();
    await expect(modal.getByRole('columnheader', { name: /Expected/i })).toBeVisible();
    await expect(modal.getByRole('columnheader', { name: /Actual/i })).toBeVisible();
    await expect(modal.getByRole('columnheader', { name: /Deviation/i })).toBeVisible();
  });

  test('completed report should show data rows in the per-arm table', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 30000 });

    const tableRows = modal.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible();
    const rowCount = await tableRows.count();
    // Default config has 2 arms (Active and Placebo)
    expect(rowCount).toBeGreaterThanOrEqual(2);
  });

  test('completed report should display the clinical confidence banner', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 30000 });

    const confidenceStatement = modal.getByTestId('mc-confidence-statement');
    await expect(confidenceStatement).toBeVisible();
    await expect(confidenceStatement).toContainText(/Algorithm mathematically verified/i);
    await expect(confidenceStatement).toContainText(/10,000 independent trial simulations/i);
    await expect(confidenceStatement).toContainText(/confirming true uniform distribution/i);
  });

  test('completed report confidence banner should include the computed deviation value', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 30000 });

    const confidenceStatement = modal.getByTestId('mc-confidence-statement');
    await expect(confidenceStatement).toBeVisible();
    // Should contain a percentage value like "0.0123%"
    await expect(confidenceStatement).toContainText(/%/);
  });

  // ── Modal close behaviors ─────────────────────────────────────────────────

  test('Close button should dismiss the modal after simulation completes', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 30000 });

    // Click Close button in footer
    await modal.getByTestId('modal-close-footer').click();

    // Modal should be gone
    await expect(modal).toBeHidden({ timeout: 5000 });
  });

  test('X button in modal header should dismiss the modal after completion', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 30000 });

    // The X button aria-label="Close" in the header
    const xBtn = modal.getByRole('button', { name: /^Close$/i });
    await xBtn.first().click();

    await expect(modal).toBeHidden({ timeout: 5000 });
  });

  // ── Works with different presets ──────────────────────────────────────────

  test('Monte Carlo should complete with the Complex (Multi-strata) preset', async ({ page }) => {
    test.setTimeout(120000); // CI can be slower for complex simulation

    // Load complex preset
    await page.getByRole('button', { name: /Complex \(Multi-strata\)/i }).click();

    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Wait for the deterministic completed-state element instead of spinner disappearance
    const confidenceStatement = modal.getByTestId('mc-confidence-statement');
    await expect(confidenceStatement).toBeVisible({ timeout: 90000 });
    await expect(confidenceStatement).toContainText(/Algorithm mathematically verified/i);

    // Complex preset has 3 arms — table should have 3 rows
    const tableRows = modal.locator('tbody tr');
    await expect(tableRows).toHaveCount(3, { timeout: 10000 });

    // Confirm loader is gone (non-blocking at this point)
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 10000 });
  });

  test('Monte Carlo should complete with the Simple (Unstratified) preset', async ({ page }) => {
    await page.getByRole('button', { name: /Simple \(Unstratified\)/i }).click();

    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 60000 });

    const confidenceStatement = modal.getByTestId('mc-confidence-statement');
    await expect(confidenceStatement).toBeVisible();

    // Simple preset has 2 arms
    const tableRows = modal.locator('tbody tr');
    await expect(tableRows).toHaveCount(2, { timeout: 5000 });
  });

  // ── Legend ────────────────────────────────────────────────────────────────

  test('completed report should show the chart legend with Expected and Actual labels', async ({ page }) => {
    const mcBtn = page.getByRole('button', { name: /Run Statistical QA/i });
    await mcBtn.click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal.getByText(/Simulating trials/i)).toBeHidden({ timeout: 30000 });

    // Legend items
    await expect(modal.getByText(/Target \(Expected\)/i)).toBeVisible();
    await expect(modal.getByText(/Actual \(Simulated\)/i)).toBeVisible();
  });
});
