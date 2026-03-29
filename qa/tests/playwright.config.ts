import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for MediCore QA tests.
 * In CI, set EHR_API_URL and EHR_SERVICE_URL via GitHub Actions secrets.
 * Locally, point at your running stack (e.g. http://localhost:3013).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
    ...(process.env.CI ? [['github'] as ['github']] : []),
  ],
  use: {
    baseURL: process.env.EHR_API_URL || 'http://localhost:3013',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: {
      ...(process.env.STAGING_EHR_QA_TOKEN
        ? { Authorization: `Bearer ${process.env.STAGING_EHR_QA_TOKEN}` }
        : {}),
    },
  },
  projects: [
    {
      name: 'api-tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.EHR_API_URL || 'http://localhost:3013',
      },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'echo "Ensure EHR service is running"',
        url: process.env.EHR_SERVICE_URL || 'http://localhost:3013/health',
        reuseExistingServer: true,
      },
});
