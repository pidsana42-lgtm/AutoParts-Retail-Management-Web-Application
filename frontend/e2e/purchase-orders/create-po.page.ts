import { type Page, type Locator } from '@playwright/test';

export class CreatePoPage {
  readonly page: Page;
  readonly supplierSelect: Locator;
  readonly productSearchInput: Locator;
  readonly quantityInput: Locator;
  readonly addItemButton: Locator;
  readonly saveDraftButton: Locator;
  readonly submitButton: Locator;
  readonly validationAlert: Locator;
  readonly itemRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.supplierSelect = page.getByLabel('ชื่อบริษัท/ผู้จัดจำหน่าย');
    this.productSearchInput = page.getByPlaceholder('สแกนหรือพิมพ์ รหัส / ชื่อสินค้า...');
    this.quantityInput = page.getByPlaceholder('จำนวน');
    this.addItemButton = page.getByRole('button', { name: 'เพิ่มลงใบสั่งซื้อ' });
    this.saveDraftButton = page.getByRole('button', { name: 'บันทึกฉบับร่าง' });
    this.submitButton = page.getByRole('button', { name: /อนุมัติใบสั่งซื้อ|ส่งอนุมัติ/ });
    // getByRole('alert') เจอทั้ง banner นี้และ toast แจ้งเตือน (role="alert" เหมือนกัน) — banner ตัวนี้เท่านั้นที่มี <ul> รายการ error
    this.validationAlert = page.getByRole('alert').filter({ has: page.locator('ul') });
    this.itemRows = page.locator('table tbody tr');
  }

  async goto() {
    await this.page.goto('/owner/new-orders');
  }

  /** เลือก supplier ตัวแรกที่มีในรายการ (ไม่ใช่ตัวเลือกว่าง) คืนชื่อที่เลือกไป หรือ null ถ้าไม่มีให้เลือก */
  async selectFirstSupplier(): Promise<string | null> {
    await this.supplierSelect.click();
    const options = this.page.getByRole('option').filter({ hasNotText: 'เลือกบริษัท/ผู้จัดจำหน่าย...' });
    try {
      await options.first().waitFor({ state: 'visible', timeout: 5_000 });
    } catch {
      await this.page.keyboard.press('Escape');
      return null;
    }
    const name = await options.first().textContent();
    await options.first().click();
    return name;
  }

  async searchProduct(keyword: string) {
    await this.productSearchInput.fill(keyword);
  }

  async selectFirstSearchResult() {
    await this.page.locator('div.absolute.z-10 >> div').first().click();
  }

  async addItem(quantity: number) {
    await this.quantityInput.fill(String(quantity));
    await this.addItemButton.click();
  }
}
