import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: 'https://ajayksingh.github.io',
    headless: true,
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro viewport
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  reporter: [['html', { outputFolder: 'e2e/reports' }], ['list']],
});
