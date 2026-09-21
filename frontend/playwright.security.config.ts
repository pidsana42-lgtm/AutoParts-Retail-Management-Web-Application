import { defineConfig } from '@playwright/test';

// Separate browser profile, synthetic API responses, and the production Nginx CSP.
// Run through scripts/test-browser-security.py; never target a live deployment.
const baseURL = process.env.SECURITY_TEST_ORIGIN;
if (!baseURL || !/^https:\/\/jjautopart-pakchong\.com:\d+$/.test(baseURL)) {
  throw new Error('Run python3 scripts/test-browser-security.py');
}

export default defineConfig({
  testDir: './e2e/security',
  testMatch: '**/*.security.ts',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/security/results.json' }]],
  outputDir: 'test-results/security/artifacts',
  use: {
    baseURL,
    channel: 'chrome',
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--host-resolver-rules=MAP jjautopart-pakchong.com 127.0.0.1', '--no-proxy-server'],
    },
  },
});
