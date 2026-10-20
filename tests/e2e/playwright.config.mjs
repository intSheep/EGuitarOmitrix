import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '*.spec.mjs', timeout: 45000, workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5189', headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve.mjs', wait: { stdout: /EGuitarOmitrix Local:/ },
    env: { PORT: '5189', EGUITAR_SERVE_DIST: '1' },
    timeout: 15000,
    cwd: new URL('../../', import.meta.url).pathname,
  },
});
