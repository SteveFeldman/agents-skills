import { defineConfig } from '@playwright/test';

// A glob below contains "/**'" which must not be read as a block comment.
const ignore = ['**/express/**', '**/a11y/**'];
const retries = process.env.CI ? 2 : 1;
const traceMode = process.env.CI ? 'off' : 'retain-on-failure';

export default defineConfig({
  workers: process.env.CI ? 1 : undefined,
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries,
  testIgnore: ignore,
  reporter: [['html'], ['junit', { outputFile: 'results/junit.xml' }]],
  use: { baseURL: 'http://localhost:3000', trace: traceMode, screenshot: 'only-on-failure', video: 'retain-on-failure' },
});
