import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for MediCore QA tests
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.EHR_API_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'api-tests',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.EHR_API_URL,
      },
    },
  ],
  webServer: {
    command: 'echo "Ensure EHR service is running on port 3001"',
    url: process.env.EHR_SERVICE_URL || '',
    reuseExistingServer: !process.env.CI,
  },
});

