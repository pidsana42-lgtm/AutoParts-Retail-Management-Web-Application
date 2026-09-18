import { type Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth';
import { DashboardPage } from './dashboard.page';

const summaryItem = {
  summary_date: '2026-09-08',
  total_orders: 8,
  total_items_sold: 14,
  overdue_debt_count: 3,
  total_revenue: 12_500,
  net_revenue: 12_000,
  total_cost: 7_000,
  gross_profit: 5_000,
  margin_profit: 41.67,
  cash_amount: 7_000,
  transfer_amount: 3_000,
  credit_amount: 2_000,
  walkin_customer_amount: 6_000,
  garage_customer_amount: 4_000,
  corporate_customer_amount: 2_000,
  return_amount: 500,
  collected_debt_amount: 1_200,
  total_outstanding_amount: 3_500,
};

type DashboardRequestLog = {
  summaryUrls: string[];
  recentSalesUrls: string[];
  topSellerUrls: string[];
  debtAgingUrls: string[];
};

async function mockDashboardApis(page: Page, requests: DashboardRequestLog) {
  await page.route('**/api/dashboard/summary*', async route => {
    requests.summaryUrls.push(route.request().url());
    const url = new URL(route.request().url());
    const responseItem = url.searchParams.get('monthly_summary') === '1'
      ? { ...summaryItem, collected_debt_amount: 2_400 }
      : summaryItem;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ summary_data: [responseItem], total: 1 }),
    });
  });

  await page.route('**/api/dashboard/stock-health*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_products: 100,
        healthy_count: 80,
        low_stock_count: 15,
        out_of_stock_count: 5,
        health_percent: 80,
      }),
    });
  });

  await page.route('**/api/wms/stock-alerts*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 501,
        alert_type: 'LOW_STOCK',
        quantity_at_alert: 2,
        limit_quantity: 5,
        is_resolved: 'false',
        product_id: 701,
        product_code: 'BRAKE-E2E-01',
        product_name: 'ผ้าเบรกใกล้หมดสำหรับทดสอบ',
        unit_name: 'ชุด',
        cost_price: 450,
        supplier_id: 901,
        supplier_name: 'ผู้จัดจำหน่ายทดสอบ',
        created_at: '2026-09-08T03:00:00Z',
      }]),
    });
  });

  await page.route('**/api/dashboard/recent-sales*', async route => {
    requests.recentSalesUrls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 601,
          order_number: 'SO-E2E-0001',
          time: '2026-09-08T03:30:00Z',
          total_amount: 1_250,
          order_status: 'สำเร็จ',
          payment_method: 'เงินสด',
        }],
        total: 1,
        page: 1,
        page_size: 10,
      }),
    });
  });

  await page.route('**/api/dashboard/aging-stock*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          rank: 1,
          product_code: 'FILTER-OLD-01',
          product_name: 'ไส้กรองค้างสต็อกสำหรับทดสอบ',
          last_sold_date: '2026-01-01',
          days_aging: 250,
          remaining_qty: 4,
          unit: 'ชิ้น',
          sunk_value: 2_000,
        }],
      }),
    });
  });

  await page.route('**/api/dashboard/income-summary*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        customerData: [
          { name: 'ลูกค้าหน้าร้าน', value: 7_000, fill: '#dc2626' },
          { name: 'อู่ซ่อมรถ', value: 5_000, fill: '#f59e0b' },
        ],
        paymentData: [
          { name: 'เงินสด', value: 8_000, fill: '#16a34a' },
          { name: 'เงินโอน', value: 4_000, fill: '#2563eb' },
        ],
      }),
    });
  });

  await page.route('**/api/dashboard/top-sellers*', async route => {
    requests.topSellerUrls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 701,
          product_name: 'ผ้าเบรกขายดีสำหรับทดสอบ',
          category: 'ระบบเบรก',
          total_sold: 25,
          total_revenue: 12_500,
        }],
      }),
    });
  });

  await page.route('**/api/dashboard/debt-aging*', async route => {
    requests.debtAgingUrls.push(route.request().url());
    const url = new URL(route.request().url());
    const isCountRequest = url.searchParams.get('page_size') === '1';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: isCountRequest ? [] : [{
          customer_code: 'CUS-E2E-001',
          customer_name: 'ลูกค้าทดสอบอายุหนี้',
          total_debt: 5_000,
          remaining_balance: 3_500,
          last_purchase_date: '2026-07-01',
          age_days: 69,
          status: 'เกินกำหนด',
        }],
        total: isCountRequest ? 3 : 1,
        total_debtors: 1,
        yearly_target: 10_000,
      }),
    });
  });
}

test.describe('Dashboard', () => {
  let dashboard: DashboardPage;
  let requests: DashboardRequestLog;

  test.beforeEach(async ({ authenticatedPage }) => {
    requests = {
      summaryUrls: [],
      recentSalesUrls: [],
      topSellerUrls: [],
      debtAgingUrls: [],
    };
    await mockDashboardApis(authenticatedPage, requests);
    dashboard = new DashboardPage(authenticatedPage);
  });

  test('แสดง KPI รายการขาย สินค้าค้างสต็อก และสินค้าใกล้หมดจาก API', async ({ authenticatedPage }) => {
    await dashboard.gotoMain();

    await expect(authenticatedPage.getByText('฿ 12,000.00', { exact: true })).toBeVisible();
    await expect(authenticatedPage.getByText('สามารถทำอัตรากำไรได้ 42%')).toBeVisible();
    await expect(authenticatedPage.getByText('SO-E2E-0001')).toBeVisible();
    await expect(authenticatedPage.getByText('ไส้กรองค้างสต็อกสำหรับทดสอบ')).toBeVisible();
    await expect(authenticatedPage.getByText('ผ้าเบรกใกล้หมดสำหรับทดสอบ')).toBeVisible();
    await expect(authenticatedPage.getByText('สถานะสต็อก: ควรตรวจสอบ')).toBeVisible();
  });

  test('เปลี่ยนช่วงเวลาเป็นเดือนนี้และส่ง query ให้ Summary กับ Recent Sales', async ({ authenticatedPage }) => {
    await dashboard.gotoMain();
    requests.summaryUrls.length = 0;
    requests.recentSalesUrls.length = 0;

    await dashboard.periodButton('เดือนนี้').click();

    await expect.poll(() => requests.summaryUrls.some(requestUrl => {
      const url = new URL(requestUrl);
      return url.searchParams.get('monthly_summary') === '1' && !url.searchParams.has('ref_date');
    })).toBe(true);
    await expect.poll(() => requests.recentSalesUrls.some(requestUrl => {
      const url = new URL(requestUrl);
      return url.searchParams.get('monthly_summary') === '1'
        && url.searchParams.get('page') === '1'
        && url.searchParams.get('page_size') === '10';
    })).toBe(true);
    await expect(authenticatedPage.getByText('SO-E2E-0001')).toBeVisible();
  });

  test('แสดงข้อมูลยอดขายและเปลี่ยนจำนวนอันดับสินค้าขายดีได้', async ({ authenticatedPage }) => {
    await dashboard.gotoSales();

    await expect(authenticatedPage.getByRole('heading', { name: 'รายได้แยกประเภทลูกค้า' })).toBeVisible();
    await expect(authenticatedPage.getByText('ลูกค้าหน้าร้าน')).toBeVisible();
    await expect(authenticatedPage.getByText('เงินโอน')).toBeVisible();
    await expect(authenticatedPage.getByText('ผ้าเบรกขายดีสำหรับทดสอบ')).toBeVisible();

    await authenticatedPage.getByRole('button', { name: 'ตัวกรอง', exact: true }).click();
    await authenticatedPage.getByRole('button', { name: '5 อันดับ', exact: true }).click();

    await expect(authenticatedPage.getByRole('heading', { name: 'สินค้าขายดี 5 อันดับของร้าน' })).toBeVisible();
    await expect.poll(() => requests.topSellerUrls.some(requestUrl => (
      new URL(requestUrl).searchParams.get('limit') === '5'
    ))).toBe(true);
  });

  test('แสดง KPI และตารางอายุหนี้ พร้อมกรองสถานะเกินกำหนด', async ({ authenticatedPage }) => {
    await dashboard.gotoDebt();

    await expect(authenticatedPage.getByText('ลูกค้าทดสอบอายุหนี้')).toBeVisible();
    await expect(authenticatedPage.getByText('CUS-E2E-001')).toBeVisible();
    await expect(authenticatedPage.getByText('฿ 3,500.00', { exact: true }).first()).toBeVisible();
    await expect(authenticatedPage.getByText('฿ 1,200.00', { exact: true })).toBeVisible();
    await expect(authenticatedPage.getByText('เป้าหมาย: ฿ 3,500.00', { exact: true })).toBeVisible();

    await dashboard.periodButton('เดือนนี้').click();
    await expect(authenticatedPage.getByText('฿ 2,400.00', { exact: true })).toBeVisible();
    await expect(authenticatedPage.getByText('เป้าหมาย: ฿ 3,500.00', { exact: true })).toBeVisible();

    await authenticatedPage.getByRole('button', { name: 'ตัวกรอง', exact: true }).click();
    await authenticatedPage.getByRole('button', { name: 'เกินกำหนด', exact: true }).click();

    await expect.poll(() => requests.debtAgingUrls.some(requestUrl => {
      const url = new URL(requestUrl);
      return url.searchParams.get('status') === 'เกินกำหนด'
        && url.searchParams.get('page') === '1'
        && url.searchParams.get('page_size') === '25';
    })).toBe(true);
    await expect(authenticatedPage.getByText('ลูกค้าทดสอบอายุหนี้')).toBeVisible();
  });
});
