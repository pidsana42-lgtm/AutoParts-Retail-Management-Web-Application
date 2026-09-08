import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';

test.describe('Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('แสดงหน้า login ได้ถูกต้อง', async ({ page }) => {
    await expect(page).toHaveURL(/\/login/);
    await expect(loginPage.usernameInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
    await expect(page.getByText('ยินดีต้อนรับเข้าสู่ระบบ')).toBeVisible();
  });

  test('แสดง error เมื่อ submit โดยไม่กรอกข้อมูล', async ({ page }) => {
    await loginPage.submitButton.click();
    await expect(page.getByText('กรุณากรอกชื่อผู้ใช้งาน')).toBeVisible();
    await expect(page.getByText('กรุณากรอกรหัสผ่าน')).toBeVisible();
  });

  test('แสดง error เฉพาะ password เมื่อกรอกแค่ username', async ({ page }) => {
    await loginPage.usernameInput.fill('testuser');
    await loginPage.submitButton.click();
    await expect(page.getByText('กรุณากรอกรหัสผ่าน')).toBeVisible();
    await expect(page.getByText('กรุณากรอกชื่อผู้ใช้งาน')).not.toBeVisible();
  });

  test('toggle แสดง/ซ่อนรหัสผ่านได้', async () => {
    await loginPage.passwordInput.fill('mypassword');
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');

    await loginPage.togglePasswordButton.click();

    await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');
  });

  test('redirect ไปหน้า owner dashboard หลัง login สำเร็จ', async ({ page }) => {
    // ใช้ credential จาก env; ถ้าไม่มีให้ skip
    const user = process.env.E2E_OWNER_USER;
    const pass = process.env.E2E_OWNER_PASS;
    if (!user || !pass) {
      test.skip(true, 'E2E_OWNER_USER / E2E_OWNER_PASS ไม่ได้กำหนด — ข้ามกรณีนี้');
    }

    const dialogPromise = page.waitForEvent('dialog').catch(() => null);
    await loginPage.login(user!, pass!);

    const dialog = await Promise.race([
      dialogPromise,
      page.waitForURL(/\/owner\//, { timeout: 10_000 }).then(() => null),
    ]);

    if (dialog) {
      // หาก backend ตอบ error ให้ fail พร้อม message ชัดเจน
      const message = dialog.message();
      await dialog.dismiss();
      throw new Error(`Login dialog: ${message}`);
    }

    await expect(page).toHaveURL(/\/owner\//);
  });
});
