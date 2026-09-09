import type { Page, Route } from '@playwright/test';

export interface MockProduct {
  id: number;
  product_code: string;
  product_name: string;
  part_number?: string;
  barcode?: string;
  sale_price: number;
  quantity: number;
  max_discount_rate: number;
  brand_name?: string;
  grade_name?: string;
  model_name?: string;
  note?: string;
}

export interface MockCustomer {
  id: number;
  customer_id?: number;
  customer_name: string;
  phone_number: string;
  customer_type: {
    id: number;
    type_name: string;
    type_label: string;
  };
  is_discount_enabled: boolean;
  standard_discount_rate: number;
  ontop_discount_rate: number;
  max_credit_limit: number;
  current_debt_amount: number;
  is_credit_enabled: boolean;
  shipping_address?: string;
  registered_address?: string;
}

export const MOCK_CUSTOMER_TYPES = [
  { id: 1, type_name: 'GENERAL', type_label: 'ลูกค้าทั่วไป' },
  { id: 2, type_name: 'GARAGE', type_label: 'ลูกค้าอู่ซ่อมรถ' },
  { id: 3, type_name: 'WHOLESALE', type_label: 'ลูกค้าบริษัท' },
];

export const MOCK_PAYMENT_METHODS = [
  { id: 1, method_name: 'เงินสด' },
  { id: 2, method_name: 'QR CODE' },
  { id: 3, method_name: 'เงินเชื่อ' },
];

export const MOCK_STORE_CONFIG = {
  max_credit: 50000,
  max_overdue_days: 30,
};

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: 101,
    product_code: 'BRK-001',
    product_name: 'ผ้าเบรคหน้า Toyota Vios',
    part_number: '04465-0D050',
    barcode: '8850001001',
    sale_price: 850,
    quantity: 25,
    max_discount_rate: 10,
    brand_name: 'Bendix',
    grade_name: 'พรีเมียม',
    model_name: 'Vios 2013-2019',
  },
  {
    id: 102,
    product_code: 'OIL-002',
    product_name: 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 4L',
    part_number: 'MOT-5W30-4L',
    barcode: '8850001002',
    sale_price: 1200,
    quantity: 15,
    max_discount_rate: 15,
    brand_name: 'Motul',
    grade_name: 'สังเคราะห์แท้ 100%',
    model_name: 'เบนซินทั่วไป',
  },
];

export const MOCK_CUSTOMERS: MockCustomer[] = [
  {
    id: 10,
    customer_id: 10,
    customer_name: 'อู่สมบูรณ์การช่าง',
    phone_number: '0819998877',
    customer_type: {
      id: 2,
      type_name: 'GARAGE',
      type_label: 'ลูกค้าอู่ซ่อมรถ',
    },
    is_discount_enabled: true,
    standard_discount_rate: 0,
    ontop_discount_rate: 5,
    max_credit_limit: 50000,
    current_debt_amount: 5000,
    is_credit_enabled: true,
    shipping_address: '88 ถ.สุขุมวิท ต.แสนสุข จ.ชลบุรี',
  },
  {
    id: 20,
    customer_id: 20,
    customer_name: 'บริษัท สหพาณิชย์ จำกัด',
    phone_number: '028889999',
    customer_type: {
      id: 3,
      type_name: 'WHOLESALE',
      type_label: 'ลูกค้าบริษัท',
    },
    is_discount_enabled: false,
    standard_discount_rate: 0,
    ontop_discount_rate: 0,
    max_credit_limit: 100000,
    current_debt_amount: 0,
    is_credit_enabled: true,
    shipping_address: '99 นิคมบางพลี จ.สมุทรปราการ',
  },
];

/**
 * ตั้งค่า Network Route Interception สำหรับ POS APIs
 */
export async function setupPosApiMocks(page: Page) {
  // 1. Master Data
  await page.route('**/pos/customer-types', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CUSTOMER_TYPES),
    });
  });

  await page.route('**/pos/payment-methods', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PAYMENT_METHODS),
    });
  });

  await page.route('**/pos/store-config', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_STORE_CONFIG),
    });
  });

  // 2. Product Search
  await page.route('**/pos/products*', async (route: Route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q')?.toLowerCase() || '';

    const matches = query
      ? MOCK_PRODUCTS.filter(
          (p) =>
            p.product_name.toLowerCase().includes(query) ||
            p.product_code.toLowerCase().includes(query) ||
            p.barcode?.includes(query) ||
            p.part_number?.toLowerCase().includes(query)
        )
      : MOCK_PRODUCTS;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(matches),
    });
  });

  // 3. Customer Discount / Search
  await page.route('**/pos/customer-discount*', async (route: Route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('search')?.toLowerCase() || '';

    const matches = query
      ? MOCK_CUSTOMERS.filter(
          (c) =>
            c.customer_name.toLowerCase().includes(query) ||
            c.phone_number.includes(query)
        )
      : MOCK_CUSTOMERS;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(matches),
    });
  });

  // 4. Create POS Order
  await page.route('**/pos/orders', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const orderNumber = `INV-${Date.now()}`;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 999,
            order_number: orderNumber,
            status: 'COMPLETED',
          },
          id: 999,
          order_number: orderNumber,
        }),
      });
      return;
    }
    await route.continue();
  });

  // 5. PDF Receipt Print
  await page.route('**/pos/sales-history/*/print*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: '%PDF-1.4 Mock Receipt PDF',
    });
  });
}
