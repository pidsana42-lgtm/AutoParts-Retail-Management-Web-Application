import { test, expect } from '@playwright/test';
import { PosPageModel } from './pos.pom';
import { setupPosApiMocks } from './pos-mocks';

test.describe('POS Sales Flow - การขายหน้าร้าน', () => {
  let pos: PosPageModel;

  test.beforeEach(async ({ page }) => {
    // 1. ตั้งค่า Mock APIs เครือข่ายเพื่อความเสถียรและรวดเร็ว
    await setupPosApiMocks(page);

    // 2. เริ่มต้นเปิดหน้าจอ POS
    pos = new PosPageModel(page);
    await pos.goto();
  });

  test('Flow 1: ขายเงินสดให้ลูกค้าทั่วไป (Walk-in Customer)', async () => {
    // 1. ค้นหาสินค้าด้วยชื่อ หรือ Part Number และเพิ่มลงตะกร้า
    await pos.searchAndAddProduct('ผ้าเบรคหน้า Toyota Vios', 'ผ้าเบรคหน้า Toyota Vios');

    // ตรวจสอบสินค้าในตารางตะกร้า
    const cartRow = pos.getCartRow('ผ้าเบรคหน้า Toyota Vios');
    await expect(cartRow).toBeVisible();
    await expect(cartRow).toContainText('850.00');

    // ตรวจสอบยอดรวมสินค้าบนหน้าจอ
    await expect(pos.page.getByText('฿850.00').first()).toBeVisible();

    // 2. เลือกลูกค้าทั่วไป (Default เป็นลูกค้าทั่วไปอยู่แล้ว หรือคลิกยืนยันประเภททั่วไป)
    await pos.selectCustomerType('ทั่วไป');

    // 3. กดปุ่มยืนยันการขายเพื่อเปิด Modal ชำระเงิน
    await pos.openPaymentModal();

    // ตรวจสอบข้อมูลใน Modal ชำระเงิน
    await expect(pos.paymentModal.getByText(/ยอดชำระสุทธิ/).first()).toBeVisible();
    await expect(pos.paymentModal.getByText('850.00').first()).toBeVisible();

    // 4. กรอกจำนวนเงินสดที่รับมา (เช่น จ่ายแบงก์ 1,000 บาท)
    await pos.fillCashReceived(1000);

    // ตรวจสอบการคำนวณเงินทอนอัตโนมัติ (1,000 - 850 = 150 บาท)
    await expect(pos.changeAmountText).toContainText('150.00');

    // 5. กดปุ่มยืนยันและพิมพ์ใบเสร็จเพื่อจบการขาย
    await pos.confirmAndPrintReceipt();

    // 6. ยืนยันว่าจบการขายสำเร็จและตะกร้าถูกล้าง
    await pos.expectOrderSuccess();
  });

  test('Flow 2: ขายเงินเชื่อพร้อมคำนวณส่วนลดให้อู่ซ่อมรถ (Garage Customer)', async () => {
    // 1. ค้นหาและเพิ่มสินค้าลงตะกร้า
    await pos.searchAndAddProduct('ผ้าเบรคหน้า Toyota Vios', 'ผ้าเบรคหน้า Toyota Vios');

    // 2. ค้นหาและเลือกลูกค้าอู่ซ่อมรถ
    await pos.searchAndSelectCustomer('อู่สมบูรณ์การช่าง');

    // ตรวจสอบว่าการ์ดข้อมูลลูกค้าแสดงชื่ออู่และสิทธิ์ส่วนลด
    await expect(pos.page.getByText('อู่สมบูรณ์การช่าง').first()).toBeVisible();

    // ตรวจสอบระบบคำนวณส่วนลดอัตโนมัติของกลุ่มอู่ซ่อมรถ (เพดาน 10% + On-top 5% = 15% จาก 850 บาท = ลด 127.50 บาท -> เหลือ 722.50 บาท)
    const cartRow = pos.getCartRow('ผ้าเบรคหน้า Toyota Vios');
    await expect(cartRow).toContainText('722.50');

    // 3. เลือกช่องทางชำระเงิน "เงินเชื่อ" (Credit)
    await pos.selectPaymentMethod('เงินเชื่อ');

    // 4. กดปุ่มยืนยันการขายเพื่อเปิด Modal
    await pos.openPaymentModal();

    // ตรวจสอบข้อมูลใน Modal เงินเชื่อ
    await expect(pos.paymentModal.getByText(/เครดิตคงเหลือ/i)).toBeVisible();
    await expect(pos.paymentModal.getByText('722.50').first()).toBeVisible();

    // 5. กดจบการขาย
    await pos.confirmAndPrintReceipt();

    // 6. ตรวจสอบสถานะจบการขายสำเร็จ
    await pos.expectOrderSuccess();
  });

  test('Flow 3: เพิ่มสินค้าหลายรายการ ปรับจำนวน และตรวจสอบการคำนวณยอดเงินรวม', async () => {
    // 1. เพิ่มสินค้าชิ้นที่ 1
    await pos.searchAndAddProduct('BRK-001', 'ผ้าเบรคหน้า Toyota Vios');

    // 2. เพิ่มสินค้าชิ้นที่ 2
    await pos.searchAndAddProduct('OIL-002', 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 4L');

    // ตรวจสอบว่าในตะกร้ามี 2 รายการ
    await expect(pos.cartRows).toHaveCount(2);

    // 3. ปรับเพิ่มจำนวนชิ้นของสินค้าชิ้นที่ 1 เป็น 2 ชิ้น
    await pos.increaseQuantity('ผ้าเบรคหน้า Toyota Vios');

    // ตรวจสอบยอดรวม: (850 * 2) + 1200 = 2,900 บาท
    await expect(pos.page.getByText('฿2,900.00').first()).toBeVisible();

    // 4. เปิด Modal ชำระเงิน และตรวจสอบยอดรวมตรงกัน
    await pos.openPaymentModal();
    await expect(pos.paymentModal.getByText('2,900.00').first()).toBeVisible();

    // 5. ชำระเงินสดพอดี (2900 บาท)
    await pos.fillCashReceived(2900);
    await expect(pos.changeAmountText).toContainText('0.00');

    // 6. จบการขายสำเร็จ
    await pos.confirmAndPrintReceipt();
    await pos.expectOrderSuccess();
  });
});
