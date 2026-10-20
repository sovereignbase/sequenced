import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test',
  testMatch: '**/{array,text,map}/compatibility/**/*.spec.ts',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['./scripts/playwright-reporter.ts']],
  use: {
    trace: 'retain-on-failure',
    baseURL: 'http://127.0.0.1:4174',
  },
  webServer: {
    command: 'node test/.shared/browser-server.mjs',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
        launchOptions: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE }
          : undefined,
      },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
  ],
})
