import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '../auth/login.page';

// Credentials อ่านจาก env หรือใช้ค่า default สำหรับ dev
const OWNER_USER = process.env.E2E_OWNER_USER ?? 'admin';
const OWNER_PASS = process.env.E2E_OWNER_PASS ?? 'admin123';

type AuthFixtures = {
  loginPage: LoginPage;
  authenticatedPage: Page;
};

export const test = base.extend<AuthFixtures>({
  loginPage: async ({ page }, runFixture) => {
    await runFixture(new LoginPage(page));
  },

  /** หน้าที่ login ด้วย owner แล้วเรียบร้อย */
  authenticatedPage: async ({ page }, runFixture) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const dialogPromise = page.waitForEvent('dialog').catch(() => null);
    await loginPage.login(OWNER_USER, OWNER_PASS);

    const dialog = await Promise.race([
      dialogPromise,
      page.waitForURL(/\/owner\//, { timeout: 15_000 }).then(() => null),
    ]);

    if (dialog) {
      const message = dialog.message();
      await dialog.dismiss().catch(() => {});
      throw new Error(`Login ล้มเหลวด้วย credential ที่กำหนด (E2E_OWNER_USER/E2E_OWNER_PASS) — ${message}`);
    }

    await runFixture(page);
  },
});

export { expect } from '@playwright/test';
