/**
 * Zero-Trust Architecture Verification
 *
 * Equipose's primary value proposition is 100% client-side execution:
 * "No data is stored on or transmitted to external servers."
 *
 * This test suite enforces the zero-trust promise by intercepting ALL network
 * traffic during the full schema generation and export workflow and asserting
 * that no outbound requests are made to any domain other than the local
 * development server.
 *
 * A single violation (analytics ping, CDN font fetch, error-tracking beacon,
 * etc.) will cause this suite to fail, preventing accidental introduction of
 * third-party data transmission.
 *
 * @regulatory 21_CFR_PART11_DATA_INTEGRITY
 */

import { test, expect, Request } from '@playwright/test';
import { generateSchemaFromPreset, openGenerator } from './generator-helpers';

const LOCAL_ORIGIN = 'http://localhost:4200';

/** Returns true when a request targets a domain other than the local dev server. */
function isExternalRequest(req: Request): boolean {
  const url = req.url();
  // Allow all requests to the local origin (static assets, SW, etc.)
  if (url.startsWith(LOCAL_ORIGIN)) return false;
  // Allow data: and blob: URIs (e.g. PDF blob, canvas data URL)
  if (url.startsWith('data:') || url.startsWith('blob:')) return false;
  // Everything else is external
  return true;
}

test.describe('Zero-Trust Architecture: no outbound network requests', () => {
  test('schema generation produces zero outbound XHR/Fetch requests to external servers', async ({ page }) => {
    const externalRequests: string[] = [];

    // Capture every network request before it fires.
    page.on('request', req => {
      if (isExternalRequest(req)) {
        externalRequests.push(`[${req.method()}] ${req.url()}`);
      }
    });

    // Exercise the full schema generation workflow.
    await generateSchemaFromPreset(page, 'Complex');

    expect(externalRequests).toHaveLength(0);
  });

  test('CSV export produces zero outbound requests to external servers', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', req => {
      if (isExternalRequest(req)) {
        externalRequests.push(`[${req.method()}] ${req.url()}`);
      }
    });

    await generateSchemaFromPreset(page, 'Standard');

    // Trigger CSV download
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    const csvButton = page.locator('#results-section').getByRole('button', { name: /CSV/i });
    await csvButton.evaluate((node: HTMLElement) => node.click());
    await downloadPromise;

    expect(externalRequests).toHaveLength(0);
  });

  test('PDF export produces zero outbound requests to external servers', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', req => {
      if (isExternalRequest(req)) {
        externalRequests.push(`[${req.method()}] ${req.url()}`);
      }
    });

    await generateSchemaFromPreset(page, 'Standard');

    // Trigger PDF download
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    const pdfButton = page.locator('#results-section').getByRole('button', { name: /PDF/i });
    await pdfButton.evaluate((node: HTMLElement) => node.click());
    await downloadPromise;

    expect(externalRequests).toHaveLength(0);
  });

  test('code generator modal produces zero outbound requests to external servers', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', req => {
      if (isExternalRequest(req)) {
        externalRequests.push(`[${req.method()}] ${req.url()}`);
      }
    });

    await generateSchemaFromPreset(page, 'Standard');

    // Open code generator and switch through all language tabs
    const generateCodeBtn = page.getByRole('button', { name: /Generate Code/i });
    await expect(generateCodeBtn).toBeVisible();
    await generateCodeBtn.click();
    await page.getByRole('menuitem', { name: /R Script/i }).click();

    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Switch through all tabs to trigger all code generation paths
    await modal.getByRole('button', { name: /Python/i }).click();
    await modal.getByRole('button', { name: /SAS/i }).click();
    await modal.getByRole('button', { name: /Stata/i }).click();

    await modal.getByRole('button', { name: /Close/i }).first().click();

    expect(externalRequests).toHaveLength(0);
  });

  test('landing page loads with zero outbound requests to external servers', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', req => {
      if (isExternalRequest(req)) {
        externalRequests.push(`[${req.method()}] ${req.url()}`);
      }
    });

    await page.goto(LOCAL_ORIGIN);
    await expect(page.getByRole('heading', { name: /Equipose/i })).toBeVisible();

    expect(externalRequests).toHaveLength(0);
  });

  test('generator page navigation with full form produces zero outbound requests', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', req => {
      if (isExternalRequest(req)) {
        externalRequests.push(`[${req.method()}] ${req.url()}`);
      }
    });

    await openGenerator(page);

    expect(externalRequests).toHaveLength(0);
  });
});
