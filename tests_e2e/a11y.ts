import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';

/**
 * Runs an axe-core accessibility audit against the current page state.
 * Enforces WCAG 2.1 AA standards and fails if any "critical" or "serious"
 * violations are found.
 *
 * @param page - The Playwright Page object to audit.
 * @returns The axe accessibility scan results.
 * @throws If critical or serious WCAG 2.1 AA violations are detected.
 */
export async function checkA11y(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.filter(
    v => v.impact === 'critical' || v.impact === 'serious'
  );

  if (violations.length > 0) {
    const details = violations
      .map(v => {
        const nodes = v.nodes
          .map(n => `  Element: ${n.target.join(', ')}\n  HTML: ${n.html}`)
          .join('\n');
        return `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n  WCAG: ${v.tags.filter(t => t.startsWith('wcag')).join(', ')}\n${nodes}`;
      })
      .join('\n\n');

    throw new Error(
      `Accessibility violations found (${violations.length}):\n\n${details}`
    );
  }

  return results;
}
