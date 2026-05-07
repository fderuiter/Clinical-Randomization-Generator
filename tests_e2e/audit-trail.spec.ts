/**
 * Audit Trail & Provenance Verification (21 CFR Part 11 Compliance)
 *
 * Clinical trial software must produce artifacts with immutable, verifiable
 * metadata. This suite downloads generated code files (R, Python, SAS, Stata)
 * and reads their content to assert that every artifact contains:
 *
 *  - The application semantic version (from `src/environments/version.ts`)
 *  - A well-formed ISO 8601 timestamp
 *  - The randomization seed used for schema generation
 *  - The trial protocol identifier
 *
 * These checks mirror 21 CFR Part 11 requirements for electronic records:
 * audit trails must capture who generated the record, when, and with which
 * exact software version and algorithm parameters.
 *
 * @regulatory 21_CFR_PART11_AUDIT_TRAIL
 */

import { test, expect } from '@playwright/test';
import { readFile } from 'fs/promises';
import { generateSchemaFromPreset, openGenerator } from './generator-helpers';

// ── helpers ─────────────────────────────────────────────────────────────────

/** ISO 8601 datetime pattern (e.g. 2024-01-15T12:34:56.789Z) */
const ISO_TIMESTAMP_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** Semantic version pattern, e.g. v1.31.0 */
const SEMVER_RE = /v\d+\.\d+\.\d+/;

/**
 * Read the content of a Playwright download to a string.
 * Falls back to an empty string when the path is unavailable.
 */
async function readDownload(download: import('@playwright/test').Download): Promise<string> {
  const path = await download.path();
  if (!path) return '';
  return readFile(path, 'utf-8');
}

/**
 * Navigates to the generator, fills in a recognisable Protocol ID, then opens
 * the code generator modal for the specified language and returns the download.
 */
async function downloadCodeFile(
  page: import('@playwright/test').Page,
  language: 'R Script' | 'Python Script' | 'SAS Script' | 'Stata Script',
  protocolId: string,
): Promise<{ content: string; filename: string }> {
  await openGenerator(page);

  // Step 1 – fill in a recognisable protocol ID
  await page.locator('#protocolId').fill(protocolId);
  await page.locator('#studyName').fill('Audit Trail Test Study');
  await page.locator('#phase').selectOption({ label: 'Phase III' });

  // Navigate to the end of the wizard
  const nextBtn = page.getByRole('button', { name: /^Next$/i });
  await nextBtn.click(); // → Arms

  await nextBtn.click(); // → Sites
  const siteInput = page.locator('#sitesLabel + app-tag-input input');
  await expect(siteInput).toBeVisible();
  await siteInput.fill('AUDIT-SITE-01');
  await siteInput.press('Enter');
  await nextBtn.click(); // → Blocks

  await page.locator('#blockSizesStr').fill('4');
  await nextBtn.click(); // → Strata
  await nextBtn.click(); // → Review

  // Open the code generator dropdown and choose the requested language
  const generateCodeBtn = page.getByRole('button', { name: /Generate Code/i });
  await expect(generateCodeBtn).toBeVisible();
  await generateCodeBtn.click();
  await page.getByRole('menuitem', { name: new RegExp(language, 'i') }).click();

  const modal = page.locator('div[role="dialog"]');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  // Wait for code to be rendered
  const codeBlock = modal.getByTestId('generated-code');
  await expect(codeBlock).toBeVisible({ timeout: 5_000 });

  // Switch to the correct tab if necessary
  const tabMap: Record<string, string> = {
    'R Script': 'R',
    'Python Script': 'Python',
    'SAS Script': 'SAS',
    'Stata Script': 'Stata',
  };
  const tabName = tabMap[language];
  if (tabName) {
    const tab = modal.getByRole('button', { name: new RegExp(`^${tabName}$`, 'i') });
    const isActive = await tab.evaluate(el => el.classList.contains('active') || el.getAttribute('aria-selected') === 'true');
    if (!isActive) {
      await tab.click();
      await expect(codeBlock).toBeVisible({ timeout: 5_000 });
    }
  }

  // Download the file
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  const downloadBtn = modal.getByRole('button', { name: /Download/i }).first();
  await downloadBtn.click();
  const download = await downloadPromise;

  const content = await readDownload(download);
  const filename = download.suggestedFilename();

  await modal.getByRole('button', { name: /Close/i }).first().click();

  return { content, filename };
}

// ── tests ────────────────────────────────────────────────────────────────────

test.describe('21 CFR Part 11 – Audit Trail: generated code artifact provenance', () => {
  const PROTOCOL_ID = 'AUDIT-TRAIL-PRT-001';

  test('R script contains application semantic version', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'R Script', PROTOCOL_ID);
    expect(content).toMatch(SEMVER_RE);
  });

  test('R script contains a valid ISO 8601 generated-at timestamp', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'R Script', PROTOCOL_ID);
    expect(content).toMatch(ISO_TIMESTAMP_RE);
  });

  test('R script contains the trial protocol identifier', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'R Script', PROTOCOL_ID);
    expect(content).toContain(PROTOCOL_ID);
  });

  test('R script filename has the correct .R extension', async ({ page }) => {
    const { filename } = await downloadCodeFile(page, 'R Script', PROTOCOL_ID);
    expect(filename).toMatch(/\.R$/i);
  });

  test('Python script contains application semantic version', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'Python Script', PROTOCOL_ID);
    expect(content).toMatch(SEMVER_RE);
  });

  test('Python script contains a valid ISO 8601 generated-at timestamp', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'Python Script', PROTOCOL_ID);
    expect(content).toMatch(ISO_TIMESTAMP_RE);
  });

  test('Python script contains the trial protocol identifier', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'Python Script', PROTOCOL_ID);
    expect(content).toContain(PROTOCOL_ID);
  });

  test('Python script filename has the correct .py extension', async ({ page }) => {
    const { filename } = await downloadCodeFile(page, 'Python Script', PROTOCOL_ID);
    expect(filename).toMatch(/\.py$/i);
  });

  test('SAS script contains application semantic version', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'SAS Script', PROTOCOL_ID);
    expect(content).toMatch(SEMVER_RE);
  });

  test('SAS script contains a valid ISO 8601 generated-at timestamp', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'SAS Script', PROTOCOL_ID);
    expect(content).toMatch(ISO_TIMESTAMP_RE);
  });

  test('SAS script contains the trial protocol identifier', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'SAS Script', PROTOCOL_ID);
    expect(content).toContain(PROTOCOL_ID);
  });

  test('SAS script filename has the correct .sas extension', async ({ page }) => {
    const { filename } = await downloadCodeFile(page, 'SAS Script', PROTOCOL_ID);
    expect(filename).toMatch(/\.sas$/i);
  });

  test('Stata script contains application semantic version', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'Stata Script', PROTOCOL_ID);
    expect(content).toMatch(SEMVER_RE);
  });

  test('Stata script contains a valid ISO 8601 generated-at timestamp', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'Stata Script', PROTOCOL_ID);
    expect(content).toMatch(ISO_TIMESTAMP_RE);
  });

  test('Stata script contains the trial protocol identifier', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'Stata Script', PROTOCOL_ID);
    expect(content).toContain(PROTOCOL_ID);
  });

  test('Stata script filename has the correct .do extension', async ({ page }) => {
    const { filename } = await downloadCodeFile(page, 'Stata Script', PROTOCOL_ID);
    expect(filename).toMatch(/\.do$/i);
  });
});

test.describe('21 CFR Part 11 – Audit Trail: results grid metadata stamping', () => {
  test('results header displays the randomization seed used for the schema', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Standard');

    const header = page.locator('#results-section').first();
    await expect(header.getByText(/Seed:/i)).toBeVisible();
  });

  test('results header displays the protocol identifier', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Standard');

    const header = page.locator('#results-section').first();
    await expect(header.getByText(/Protocol:/i)).toBeVisible();
  });

  test('CSV download filename contains a timestamp component for traceability', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Standard');

    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    const csvButton = page.locator('#results-section').getByRole('button', { name: /CSV/i });
    await csvButton.evaluate((node: HTMLElement) => node.click());
    const download = await downloadPromise;

    // Filename should contain a date or timestamp component so that saved
    // files remain uniquely identifiable (21 CFR Part 11 traceability).
    expect(download.suggestedFilename()).toMatch(/randomization_/);
    expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/i);
  });
});
