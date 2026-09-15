import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';
// @ts-ignore
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // จำกัดจำนวน browser ที่เปิดพร้อมกัน เพื่อไม่ให้ dev server/backend ล้นเมื่อรันแบบ --headed
  workers: process.env.CI ? 1 : 4,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    launchOptions: {
      slowMo: process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : 0,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
