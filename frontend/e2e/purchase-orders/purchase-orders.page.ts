import { type Page, type Locator } from '@playwright/test';

export class PurchaseOrdersPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly tableRows: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'จัดการใบสั่งซื้อ' });
    this.createButton = page.getByRole('button', { name: 'สร้างใบสั่งซื้อใหม่' });
    this.searchInput = page.getByPlaceholder('PO-XXXX-XXXX');
    this.statusFilter = page.getByLabel('สถานะใบสั่งซื้อ');
    this.tableRows = page.locator('table tbody tr');
    this.emptyState = page.getByText('ไม่พบข้อมูลใบสั่งซื้อ');
  }

  async goto() {
    await this.page.goto('/owner/orders');
  }

  async waitForTable() {
    await this.page.waitForSelector('table', { timeout: 10_000 });
  }

  async search(poNumber: string) {
    await this.searchInput.fill(poNumber);
    // หน้าจอ debounce การค้นหาไว้ 400ms ก่อนยิง request
    await this.page.waitForTimeout(500);
  }

  async filterByStatus(label: string) {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: label }).click();
  }
}
