import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // จำกัด worker ไว้ที่ 4 ตอนรัน local เพราะ dev server (Vite + backend) เครื่องเดียวรับ
  // 12 browser พร้อมกันไม่ไหว (เจอ login/API timeout จาก server รับโหลดไม่ทัน ไม่ใช่บั๊กจริง)
  workers: process.env.CI ? 1 : 4,
  reporter: [['html', { outputFolder: 'e2e/playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
