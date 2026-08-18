import { defineConfig, devices } from '@playwright/test';
import { isAbsolute } from 'node:path';

const playwrightPort = (name: string, fallback: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) throw new Error(`${name} must be an integer port between 1024 and 65535`);
  return value;
};
const apiPort = playwrightPort('PLAYWRIGHT_API_PORT', Number(process.env.APP_PORT ?? 4101));
const webPort = playwrightPort('PLAYWRIGHT_WEB_PORT', 5173);
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
if (chromiumExecutablePath && !isAbsolute(chromiumExecutablePath)) {
  throw new Error('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH must be an absolute path');
}

export default defineConfig({
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  testDir: './tests/e2e',
  outputDir: './.artifacts/playwright',
  fullyParallel: false,
  workers: 4,
  retries: 0,
  reporter: [['line']],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      command: 'node scripts/run-playwright-api-stub.mjs',
      url: `http://127.0.0.1:${apiPort}/api/v1/health/live`,
      reuseExistingServer: false,
      timeout: 300_000,
    },
    {
      command: 'npm run dev:web',
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
