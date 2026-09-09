import { type Locator, type Page } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly mainHeading: Locator;
  readonly salesHeading: Locator;
  readonly debtHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainHeading = page.getByRole('heading', { name: 'กระดานแดชบอร์ด', level: 1 });
    this.salesHeading = page.getByRole('heading', { name: 'กระดานสรุปยอดขาย', level: 1 });
    this.debtHeading = page.getByRole('heading', { name: 'กระดานสรุปยอดหนี้', level: 1 });
  }

  async gotoMain() {
    await this.page.goto('/owner/dashboard/maindashboard');
    await this.mainHeading.waitFor({ state: 'visible' });
  }

  async gotoSales() {
    await this.page.goto('/owner/dashboard/salesdashboard');
    await this.salesHeading.waitFor({ state: 'visible' });
  }

  async gotoDebt() {
    await this.page.goto('/owner/dashboard/debtdashboard');
    await this.debtHeading.waitFor({ state: 'visible' });
  }

  periodButton(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }
}
