/**
 * Audit Trail & Provenance Verification (21 CFR Part 11 Compliance)
 *
 * Clinical trial software must produce artifacts with immutable, verifiable
 * metadata. This suite downloads generated code files (R, Python, SAS, Stata)
 * and reads their content to assert that every artifact contains:
 *
 *  - The application semantic version (from `src/environments/version.ts`)
 *  - A well-formed ISO 8601 timestamp (milliseconds + Z suffix, as produced by `new Date().toISOString()`)
 *  - The PRNG seed initialisation statement (the numeric seed embedded at generation time)
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
import { PDFParse } from 'pdf-parse';
import { generateSchemaFromPreset, openGenerator } from './generator-helpers';

/**
 * Extract all text from a PDF buffer using the pdf-parse v2 class API.
 * Returns the concatenated text string across all pages.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // Buffer extends Uint8Array, so it satisfies the LoadParameters.data type directly.
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** ISO 8601 datetime pattern matching the exact format from `new Date().toISOString()`,
 *  e.g. 2024-01-15T12:34:56.789Z (milliseconds + Z timezone suffix required). */
const ISO_TIMESTAMP_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/;

/** Semantic version pattern, e.g. v1.31.0 */
const SEMVER_RE = /v\d+\.\d+\.\d+/;

/**
 * Each language embeds the numeric PRNG seed via a distinct statement.
 * These patterns assert the seed initialisation call is present in the artifact.
 */
const SEED_PATTERNS: Record<string, RegExp> = {
  'R Script':     /set\.seed\(\d+\)/,
  'Python Script':/np\.random\.default_rng\(\d+\)/,
  // The SAS generator always emits `%let seed = <number>;` at the top.
  // `call streaminit(&seed.)` is a downstream use of that macro variable, so
  // validating the definition (with its numeric value) is sufficient.
  'SAS Script':   /%let seed\s*=\s*\d+/,
  'Stata Script': /set seed \d+/i,
};

/**
 * Read the content of a Playwright download to a Buffer.
 * Returns null when the path is unavailable.
 */
async function readDownloadBuffer(download: import('@playwright/test').Download): Promise<Buffer | null> {
  const path = await download.path();
  if (!path) return null;
  return readFile(path);
}

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
): Promise<{ content: string; filename: string; language: typeof language }> {
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

  return { content, filename, language };
}

// ── tests ────────────────────────────────────────────────────────────────────

test.describe('21 CFR Part 11 – Audit Trail: generated code artifact provenance', () => {
  const PROTOCOL_ID = 'AUDIT-TRAIL-PRT-001';

  // [REQ-21CFR11-001]
  test('R script contains application semantic version', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'R Script', PROTOCOL_ID);
    expect(content).toMatch(SEMVER_RE);
  });

  // [REQ-21CFR11-002]
  test('R script contains a valid ISO 8601 generated-at timestamp', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'R Script', PROTOCOL_ID);
    expect(content).toMatch(ISO_TIMESTAMP_RE);
  });

  // [REQ-21CFR11-003]
  test('R script contains the trial protocol identifier', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'R Script', PROTOCOL_ID);
    expect(content).toContain(PROTOCOL_ID);
  });

  test('R script filename has the correct .R extension', async ({ page }) => {
    const { filename } = await downloadCodeFile(page, 'R Script', PROTOCOL_ID);
    expect(filename).toMatch(/\.R$/i);
  });

  // [REQ-21CFR11-004]
  test('R script contains the PRNG seed initialisation statement', async ({ page }) => {
    const { content, language } = await downloadCodeFile(page, 'R Script', PROTOCOL_ID);
    expect(content).toMatch(SEED_PATTERNS[language]);
  });

  // [REQ-21CFR11-001]
  test('Python script contains application semantic version', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'Python Script', PROTOCOL_ID);
    expect(content).toMatch(SEMVER_RE);
  });

  // [REQ-21CFR11-002]
  test('Python script contains a valid ISO 8601 generated-at timestamp', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'Python Script', PROTOCOL_ID);
    expect(content).toMatch(ISO_TIMESTAMP_RE);
  });

  // [REQ-21CFR11-003]
  test('Python script contains the trial protocol identifier', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'Python Script', PROTOCOL_ID);
    expect(content).toContain(PROTOCOL_ID);
  });

  test('Python script filename has the correct .py extension', async ({ page }) => {
    const { filename } = await downloadCodeFile(page, 'Python Script', PROTOCOL_ID);
    expect(filename).toMatch(/\.py$/i);
  });

  // [REQ-21CFR11-004]
  test('Python script contains the PRNG seed initialisation statement', async ({ page }) => {
    const { content, language } = await downloadCodeFile(page, 'Python Script', PROTOCOL_ID);
    expect(content).toMatch(SEED_PATTERNS[language]);
  });

  // [REQ-21CFR11-001]
  test('SAS script contains application semantic version', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'SAS Script', PROTOCOL_ID);
    expect(content).toMatch(SEMVER_RE);
  });

  // [REQ-21CFR11-002]
  test('SAS script contains a valid ISO 8601 generated-at timestamp', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'SAS Script', PROTOCOL_ID);
    expect(content).toMatch(ISO_TIMESTAMP_RE);
  });

  // [REQ-21CFR11-003]
  test('SAS script contains the trial protocol identifier', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'SAS Script', PROTOCOL_ID);
    expect(content).toContain(PROTOCOL_ID);
  });

  test('SAS script filename has the correct .sas extension', async ({ page }) => {
    const { filename } = await downloadCodeFile(page, 'SAS Script', PROTOCOL_ID);
    expect(filename).toMatch(/\.sas$/i);
  });

  // [REQ-21CFR11-004]
  test('SAS script contains the PRNG seed initialisation statement', async ({ page }) => {
    const { content, language } = await downloadCodeFile(page, 'SAS Script', PROTOCOL_ID);
    expect(content).toMatch(SEED_PATTERNS[language]);
  });

  // [REQ-21CFR11-001]
  test('Stata script contains application semantic version', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'Stata Script', PROTOCOL_ID);
    expect(content).toMatch(SEMVER_RE);
  });

  // [REQ-21CFR11-002]
  test('Stata script contains a valid ISO 8601 generated-at timestamp', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'Stata Script', PROTOCOL_ID);
    expect(content).toMatch(ISO_TIMESTAMP_RE);
  });

  // [REQ-21CFR11-003]
  test('Stata script contains the trial protocol identifier', async ({ page }) => {
    const { content } = await downloadCodeFile(page, 'Stata Script', PROTOCOL_ID);
    expect(content).toContain(PROTOCOL_ID);
  });

  test('Stata script filename has the correct .do extension', async ({ page }) => {
    const { filename } = await downloadCodeFile(page, 'Stata Script', PROTOCOL_ID);
    expect(filename).toMatch(/\.do$/i);
  });

  // [REQ-21CFR11-004]
  test('Stata script contains the PRNG seed initialisation statement', async ({ page }) => {
    const { content, language } = await downloadCodeFile(page, 'Stata Script', PROTOCOL_ID);
    expect(content).toMatch(SEED_PATTERNS[language]);
  });
});

// ── PDF Audit Trail ───────────────────────────────────────────────────────────

/**
 * Downloads the PDF export using the Standard preset and returns the parsed text.
 * Uses pdf-parse to extract text from the binary PDF buffer.
 * Note: this helper does not set a custom protocol ID; use downloadPdfTextWithProtocol
 * when a specific protocol ID is required.
 */
async function downloadPdfText(page: import('@playwright/test').Page, protocolId: string): Promise<string> {
  await generateSchemaFromPreset(page, 'Standard');

  const pdfButton = page.locator('#results-section').getByRole('button', { name: /PDF/i });
  await expect(pdfButton).toBeVisible({ timeout: 10_000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
  await pdfButton.click();
  const download = await downloadPromise;

  const buffer = await readDownloadBuffer(download);
  const filename = download.suggestedFilename();

  if (!buffer || buffer.byteLength === 0) {
    throw new Error(
      `PDF download produced an empty buffer for filename "${filename}". ` +
      `Check that the PDF export button triggers a real download and that ` +
      `the PDF generation service is running correctly.`,
    );
  }

  try {
    return await extractPdfText(buffer);
  } catch (err) {
    throw new Error(
      `pdf-parse failed to parse the downloaded PDF ("${filename}"): ${err}.\n` +
      `Buffer size was ${buffer.byteLength} bytes. ` +
      `Verify the PDF export produces a valid PDF/1.x file.`,
    );
  }
}

/**
 * Generates a schema with a specific protocol ID then downloads the PDF.
 *
 * Robustness notes:
 *  - Explicitly waits for the PDF button to be visible before clicking,
 *    to ensure the results section has fully rendered.
 *  - Guards against empty buffers and surfaces pdf-parse failures with
 *    actionable messages instead of opaque throws.
 */
async function downloadPdfTextWithProtocol(
  page: import('@playwright/test').Page,
  protocolId: string,
): Promise<{ text: string; filename: string }> {
  await openGenerator(page);

  await page.locator('#protocolId').fill(protocolId);
  await page.locator('#studyName').fill('PDF Audit Test Study');
  await page.locator('#phase').selectOption({ label: 'Phase III' });

  const nextBtn = page.getByRole('button', { name: /^Next$/i });
  await nextBtn.click(); // → Arms
  await nextBtn.click(); // → Sites

  const siteInput = page.locator('#sitesLabel + app-tag-input input');
  await expect(siteInput).toBeVisible();
  await siteInput.fill('PDF-SITE-01');
  await siteInput.press('Enter');
  await nextBtn.click(); // → Blocks

  await page.locator('#blockSizesStr').fill('4');
  await nextBtn.click(); // → Strata
  await nextBtn.click(); // → Review

  const generateBtn = page.getByRole('button', { name: /Generate Schema/i });
  await expect(generateBtn).toBeVisible();
  await generateBtn.click();

  const resultsSection = page.locator('#results-section');
  await expect(resultsSection).toBeVisible({ timeout: 15_000 });

  // Wait for the PDF button to be visible before attempting to click it,
  // ensuring the results section has fully rendered all action buttons.
  const pdfButton = resultsSection.getByRole('button', { name: /PDF/i });
  await expect(pdfButton).toBeVisible({ timeout: 10_000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
  await pdfButton.click();
  const download = await downloadPromise;

  const filename = download.suggestedFilename();
  const buffer = await readDownloadBuffer(download);

  // Guard: surface actionable errors instead of a cryptic pdfParse throw.
  if (!buffer || buffer.byteLength === 0) {
    throw new Error(
      `PDF download produced an empty buffer for filename "${filename}". ` +
      `Check that the PDF export button triggers a real download and that ` +
      `the PDF generation service is running correctly.`,
    );
  }

  try {
    const text = await extractPdfText(buffer);
    return { text, filename };
  } catch (err) {
    throw new Error(
      `pdf-parse failed to parse the downloaded PDF ("${filename}"): ${err}.\n` +
      `Buffer size was ${buffer.byteLength} bytes. ` +
      `Verify the PDF export produces a valid PDF/1.x file.`,
    );
  }
}

test.describe('21 CFR Part 11 – Audit Trail: PDF export provenance', () => {
  const PDF_PROTOCOL_ID = 'PDF-AUDIT-PRT-001';

  // [REQ-21CFR11-006]
  test('PDF export contains the application semantic version', async ({ page }) => {
    const { text } = await downloadPdfTextWithProtocol(page, PDF_PROTOCOL_ID);
    expect(text).toMatch(SEMVER_RE);
  });

  // [REQ-21CFR11-006]
  test('PDF export contains a valid ISO 8601 generated-at timestamp', async ({ page }) => {
    const { text } = await downloadPdfTextWithProtocol(page, PDF_PROTOCOL_ID);
    expect(text).toMatch(ISO_TIMESTAMP_RE);
  });

  // [REQ-21CFR11-006]
  test('PDF export contains the trial protocol identifier', async ({ page }) => {
    const { text } = await downloadPdfTextWithProtocol(page, PDF_PROTOCOL_ID);
    expect(text).toContain(PDF_PROTOCOL_ID);
  });

  // [REQ-21CFR11-006]
  test('PDF export contains the PRNG seed value', async ({ page }) => {
    const { text } = await downloadPdfTextWithProtocol(page, PDF_PROTOCOL_ID);
    // The metadata table has a "PRNG Seed" row with a numeric value.
    // Match the label and an adjacent sequence of digits.
    expect(text).toContain('PRNG Seed');
    expect(text).toMatch(/PRNG\s+Seed[:\s]+\d+/);
  });

  // [REQ-EXPORT-002]
  test('PDF export filename matches the expected pattern', async ({ page }) => {
    const { filename } = await downloadPdfTextWithProtocol(page, PDF_PROTOCOL_ID);
    expect(filename).toMatch(/^randomization_.*\.pdf$/i);
  });
});

test.describe('21 CFR Part 11 – Audit Trail: results grid metadata stamping', () => {
  // [REQ-21CFR11-004]
  test('results header displays the randomization seed used for the schema', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Standard');

    const header = page.locator('#results-section').first();
    await expect(header.getByText(/Seed:/i)).toBeVisible();
  });

  // [REQ-21CFR11-003]
  test('results header displays the protocol identifier', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Standard');

    const header = page.locator('#results-section').first();
    await expect(header.getByText(/Protocol:/i)).toBeVisible();
  });

  // [REQ-EXPORT-001]
  test('CSV download filename contains a date component for traceability', async ({ page }) => {
    await generateSchemaFromPreset(page, 'Standard');

    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    const csvButton = page.locator('#results-section').getByRole('button', { name: /CSV/i });
    await csvButton.evaluate((node: HTMLElement) => node.click());
    const download = await downloadPromise;

    const name = download.suggestedFilename();
    // Filename must begin with the expected prefix and end with the correct extension.
    expect(name).toMatch(/^randomization_/);
    expect(name).toMatch(/\.(csv|xlsx)$/i);
    // Must contain an eight-digit date component (YYYYMMDD) so that saved files
    // are uniquely identifiable per-generation (21 CFR Part 11 traceability).
    expect(name).toMatch(/\d{8}/);
  });
});
