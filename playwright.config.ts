import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/app',
  timeout: 30_000,
  // Test the standalone clinic in three browser engines.
  workers: 2,
  use: { baseURL:'http://127.0.0.1:4184', trace:'retain-on-failure' },
  projects: [
    { name:'chromium', use:{ ...devices['Desktop Chrome'] } },
    { name:'firefox', use:{ ...devices['Desktop Firefox'] } },
    { name:'webkit', use:{ ...devices['Desktop Safari'] } },
  ],
  webServer: { command:'npm run build && node scripts/serve-app.mjs', url:'http://127.0.0.1:4184/doctor/', reuseExistingServer:!process.env.CI, timeout:120_000 },
});
