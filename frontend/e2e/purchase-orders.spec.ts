import { test, expect } from './fixtures/auth';
import { PurchaseOrdersPage } from './pages/purchase-orders.page';
import { CreatePoPage } from './pages/create-po.page';

test.describe('รายการใบสั่งซื้อ (PO List)', () => {
  let poPage: PurchaseOrdersPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    poPage = new PurchaseOrdersPage(authenticatedPage);
    await poPage.goto();
    await poPage.waitForTable();
  });

  test('แสดงหัวข้อและตารางใบสั่งซื้อได้ถูกต้อง', async () => {
    await expect(poPage.heading).toBeVisible();
    await expect(poPage.createButton).toBeVisible();
    await expect(poPage.searchInput).toBeVisible();
  });

  test('กดปุ่มสร้างใบสั่งซื้อใหม่แล้วไปหน้าสร้าง PO', async ({ authenticatedPage }) => {
    await poPage.createButton.click();
    await expect(authenticatedPage).toHaveURL(/\/owner\/new-orders/);
  });

  test('ค้นหาด้วยเลขที่ใบสั่งซื้อที่ไม่มีจริงต้องไม่พบข้อมูล', async () => {
    await poPage.search('PO-NOT-EXIST-000000');
    // แถวว่าง ("ไม่พบข้อมูลใบสั่งซื้อ") ก็เป็น <tr> เหมือนกัน จึงเช็คแค่ empty state ไม่เช็คจำนวนแถว
    await expect(poPage.emptyState).toBeVisible();
  });

  test('กรองตามสถานะได้โดยไม่เกิด error', async ({ authenticatedPage }) => {
    await poPage.filterByStatus('ฉบับร่าง');
    await expect(authenticatedPage.getByText('เกิดข้อผิดพลาดในการเชื่อมต่อ')).not.toBeVisible();
  });
});

test.describe('สร้างใบสั่งซื้อ (Create PO)', () => {
  let createPoPage: CreatePoPage;

  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/wms/suppliers', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 900001, supplier_name: 'ผู้จัดจำหน่ายสำหรับทดสอบ Playwright' },
        ]),
      });
    });
    await authenticatedPage.route('**/api/wms/pre-orders/for-po-selection*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });
    await authenticatedPage.route('**/api/po/suppliers/900001/delivery-estimate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          supplier_id: 900001,
          has_enough_data: false,
          estimated_days: 0,
          accuracy_rate: 0,
        }),
      });
    });

    createPoPage = new CreatePoPage(authenticatedPage);
    await createPoPage.goto();
  });

  test('ช่องค้นหาสินค้าถูกปิดไว้จนกว่าจะเลือกผู้จัดจำหน่าย', async () => {
    await expect(createPoPage.productSearchInput).toBeDisabled();
  });

  test('แสดง validation error เมื่อกดส่งอนุมัติโดยไม่กรอกข้อมูล', async () => {
    await createPoPage.submitButton.click();
    await expect(createPoPage.validationAlert).toBeVisible();
    await expect(createPoPage.validationAlert).toContainText('กรุณาเลือกผู้จัดจำหน่าย');
    await expect(createPoPage.validationAlert).toContainText('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
  });

  test('แสดง validation error เฉพาะเรื่องสินค้า เมื่อเลือกผู้จัดจำหน่ายแล้วแต่ยังไม่เพิ่มสินค้า', async () => {
    const supplier = await createPoPage.selectFirstSupplier();
    expect(supplier).toBe('ผู้จัดจำหน่ายสำหรับทดสอบ Playwright');

    await createPoPage.submitButton.click();
    await expect(createPoPage.validationAlert).toBeVisible();
    await expect(createPoPage.validationAlert).toContainText('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
    await expect(createPoPage.validationAlert).not.toContainText('กรุณาเลือกผู้จัดจำหน่าย');
  });

  test('เลือกผู้จัดจำหน่าย ค้นหาสินค้า เพิ่มลงตะกร้า แล้วบันทึกฉบับร่างได้สำเร็จ', async ({ authenticatedPage }) => {
    let createPayload: Record<string, unknown> | undefined;
    await authenticatedPage.route('**/api/po/product-search*', async route => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get('q')).toBe('E2E-FILTER');
      expect(url.searchParams.get('supplier_id')).toBe('900001');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            id: 700001,
            code: 'E2E-FILTER-001',
            barcode: '8850000700001',
            name: 'ไส้กรองสำหรับทดสอบ Playwright',
            price: 125.5,
            unit: 'ชิ้น',
            stock_qty: 10,
          }],
        }),
      });
    });
    await authenticatedPage.route('**/api/po/new-po', async route => {
      createPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 800001,
          po_number: 'PO-E2E-0001',
          supplier_id: 900001,
          total_amount: 251,
          status: 'DRAFT',
        }),
      });
    });

    const supplier = await createPoPage.selectFirstSupplier();
    expect(supplier).toBe('ผู้จัดจำหน่ายสำหรับทดสอบ Playwright');

    await expect(createPoPage.productSearchInput).toBeEnabled();

    await createPoPage.searchProduct('E2E-FILTER');
    const firstResult = authenticatedPage.locator('div.absolute.z-10 .cursor-pointer').first();
    await expect(firstResult).toContainText('ไส้กรองสำหรับทดสอบ Playwright');
    await firstResult.click();
    await createPoPage.addItem(2);

    await expect(createPoPage.itemRows).toHaveCount(1);

    await createPoPage.saveDraftButton.click();
    await expect(authenticatedPage).toHaveURL(/\/owner\/orders$/, { timeout: 10_000 });
    expect(createPayload).toMatchObject({
      supplier_id: 900001,
      status: 'DRAFT',
      po_items: [{ product_id: 700001, quantity: 2, unit_price: 125.5 }],
    });
  });
});
