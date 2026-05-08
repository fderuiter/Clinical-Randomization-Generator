import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests_e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // In CI: emit both a blob (for shard merging) and a JSON (for RTM generation).
  reporter: process.env.CI ? [['blob'], ['line'], ['json', { outputFile: 'playwright-results.json' }]] : 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
