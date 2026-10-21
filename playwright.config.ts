import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // PW_CHANNEL=msedge (o chrome) usa el navegador instalado en vez de descargar Chromium.
  use: { baseURL: 'http://localhost:3100', trace: 'on-first-retry', channel: process.env.PW_CHANNEL },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: process.env.PW_CHANNEL } },
  ],
  webServer: {
    command: 'npx serve@14 out -l 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
  },
});
