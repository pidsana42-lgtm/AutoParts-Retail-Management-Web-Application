import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Object Model สำหรับหน้าจอ POS (Point of Sale)
 * ออกแบบโดยใช้ User-facing / Accessible Locators เพื่อความทนทานต่อการเปลี่ยนแปลง UI
 */
export class PosPageModel {
  readonly page: Page;

  // Header & Cart Area
  readonly posHeading: Locator;
  readonly productSearchInput: Locator;
  readonly addProductButton: Locator;
  readonly cartTable: Locator;
  readonly cartRows: Locator;
  readonly clearAllButton: Locator;

  // Customer Section
  readonly customerSearchInput: Locator;
  readonly customerPhoneInput: Locator;
  readonly customerAddressInput: Locator;
  readonly selectCustomerButton: Locator;
  readonly customerCard: Locator;

  // Totals & Checkout
  readonly totalItemPriceText: Locator;
  readonly finalTotalText: Locator;
  readonly confirmSaleButton: Locator;

  // Payment Modal
  readonly paymentModal: Locator;
  readonly modalFinalTotalText: Locator;
  readonly cashReceivedInput: Locator;
  readonly changeAmountText: Locator;
  readonly finalConfirmButton: Locator;
  readonly modalCancelButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header & Cart
    this.posHeading = page.getByRole('heading', { name: 'POS', exact: true });
    this.productSearchInput = page.getByPlaceholder(/สแกนบาร์โค้ดสินค้า|พิมพ์เลขบาร์โค้ด/i);
    this.addProductButton = page.getByRole('button', { name: 'เพิ่มรายการ', exact: true });
    this.cartTable = page.locator('table');
    this.cartRows = page.locator('tbody tr').filter({ hasNotText: 'ยังไม่มีสินค้าในตะกร้า' });
    this.clearAllButton = page.getByRole('button', { name: 'ล้างทั้งหมด', exact: true });

    // Customer
    this.customerSearchInput = page.getByPlaceholder(/พิมพ์ชื่ออู่, เบอร์โทรสมาชิก/i);
    this.customerPhoneInput = page.getByPlaceholder(/ระบุเบอร์โทรติดต่อส่งของ/i);
    this.customerAddressInput = page.getByPlaceholder(/ระบุที่อยู่จัดส่ง\/ออกใบเสร็จ/i);
    this.selectCustomerButton = page.getByRole('button', { name: 'เลือกลูกค้า', exact: true });
    this.customerCard = page.locator('div').filter({ has: page.getByText(/ข้อมูลลูกค้า/i) }).locator('..');

    // Totals & Checkout
    this.totalItemPriceText = page.locator('div').filter({ hasText: /^ราคารวมสินค้า/ }).locator('p, span').last();
    this.finalTotalText = page.locator('div').filter({ hasText: /^ยอดชำระสุทธิ/ }).locator('p, span').last();
    this.confirmSaleButton = page.getByRole('button', { name: 'ยืนยันการขาย', exact: true });

    // Payment Modal
    this.paymentModal = page.locator('div.fixed').filter({ hasText: /ชำระเงิน \(/i });
    this.modalFinalTotalText = this.paymentModal.locator('div').filter({ hasText: /^ยอดชำระสุทธิ/ }).locator('p, span').last();
    this.cashReceivedInput = this.paymentModal.getByPlaceholder('0.00');
    this.changeAmountText = this.paymentModal.locator('div').filter({ hasText: /^ยอดเงินทอน/ });
    this.finalConfirmButton = this.paymentModal.getByRole('button', { name: /ยืนยันและพิมพ์ใบเสร็จ/i });
    this.modalCancelButton = this.paymentModal.getByRole('button', { name: 'ยกเลิก', exact: true });
  }

  /**
   * จำลอง Authentication Session ใน LocalStorage และเปิดหน้าจอ POS
   */
  async goto() {
    await this.page.addInitScript(() => {
      window.localStorage.setItem('token', 'e2e-mock-jwt-token');
      window.localStorage.setItem('role', 'EMPLOYEE');
      window.localStorage.setItem(
        'user',
        JSON.stringify({
          id: '1',
          name: 'สมศรี แคชเชียร์',
          username: 'somsri',
          first_name: 'สมศรี',
          last_name: 'ใจดี',
        })
      );
      // เคลียร์ session ค้างเพื่อความสดใหม่ในการทดสอบ
      window.localStorage.removeItem('pos_cart');
      window.localStorage.removeItem('pos_session');
    });

    // กำหนด URL แบบเต็ม (สามารถปรับเปลี่ยนพอร์ตตามที่รัน Frontend จริง เช่น 5173 หรือ 3000)
    await this.page.goto('http://localhost:5173/employee/pos/pos');
    await expect(this.posHeading).toBeVisible();
  }

  /**
   * ค้นหาสินค้าและกดเพิ่มลงตะกร้า (ผ่าน Form Submit หรือคลิก Dropdown Suggestion)
   */
  async searchAndAddProduct(keyword: string, expectedProductName?: string) {
    await this.productSearchInput.fill(keyword);

    // ตรวจสอบว่ามี Dropdown Suggestion ปรากฏหรือไม่
    const suggestion = this.page
      .locator('.absolute')
      .filter({ hasText: expectedProductName || keyword })
      .first();

    if (await suggestion.isVisible({ timeout: 1500 }).catch(() => false)) {
      await suggestion.click();
    } else {
      await this.addProductButton.click();
    }

    if (expectedProductName) {
      await expect(this.cartRows.filter({ hasText: expectedProductName })).toBeVisible();
    }
  }

  /**
   * ค้นหาแถวสินค้าในตะกร้าตามชื่อ
   */
  getCartRow(productName: string): Locator {
    return this.cartRows.filter({ hasText: productName }).first();
  }

  /**
   * ปรับเพิ่มจำนวนสินค้าในตะกร้า (+)
   */
  async increaseQuantity(productName: string) {
    const row = this.getCartRow(productName);
    const plusButton = row.locator('button').filter({ has: this.page.locator('svg.lucide-plus') });
    await plusButton.click();
  }

  /**
   * ปรับลดจำนวนสินค้าในตะกร้า (-)
   */
  async decreaseQuantity(productName: string) {
    const row = this.getCartRow(productName);
    const minusButton = row.locator('button').filter({ has: this.page.locator('svg.lucide-minus') });
    await minusButton.click();
  }

  /**
   * เลือกลูกค้าผ่านแท็บประเภทลูกค้าด้านขวา
   */
  async selectCustomerType(typeName: 'ทั่วไป' | 'อู่ซ่อมรถ' | 'บริษัท') {
    const tabButton = this.page.getByRole('button', { name: new RegExp(typeName, 'i') });
    await tabButton.click();
  }

  /**
   * ค้นหาและเลือกลูกค้าจากรายชื่อสมาชิก (Autocomplete)
   */
  async searchAndSelectCustomer(customerNameOrPhone: string) {
    await this.customerSearchInput.fill(customerNameOrPhone);

    const suggestionItem = this.page
      .locator('.absolute')
      .getByText(customerNameOrPhone)
      .first();

    await expect(suggestionItem).toBeVisible();
    await suggestionItem.click();

    // รอให้การ์ดข้อมูลลูกค้าอัปเดตชื่อลูกค้า
    await expect(this.page.getByText(customerNameOrPhone).first()).toBeVisible();
  }

  /**
   * เปิด Modal ชำระเงิน
   */
  async openPaymentModal() {
    await this.confirmSaleButton.click();
    await expect(this.paymentModal).toBeVisible();
  }

  /**
   * เลือกช่องทางการชำระเงินในหน้าจอหลัก หรือใน Modal
   */
  async selectPaymentMethod(methodName: 'เงินสด' | 'QR CODE' | 'เงินเชื่อ') {
    const methodButton = this.page.getByRole('button', { name: methodName });
    await methodButton.click();
  }

  /**
   * กรอกจำนวนเงินสดที่รับมา หรือคลิกปุ่มเงินสดด่วน
   */
  async fillCashReceived(amount: number) {
    // ลองใช้ปุ่มทางลัด เช่น '1000 บาท' หากมีตรงกัน
    const quickButton = this.paymentModal.getByRole('button', { name: `${amount} บาท` });
    if (await quickButton.isVisible().catch(() => false)) {
      await quickButton.click();
    } else {
      await this.cashReceivedInput.click();
      await this.cashReceivedInput.fill(String(amount));
      await this.cashReceivedInput.blur();
    }
  }

  /**
   * ยืนยันการชำระเงินและปิดการขาย
   */
  async confirmAndPrintReceipt() {
    await this.finalConfirmButton.click();
  }

  /**
   * ตรวจสอบว่ามี Toast แจ้งเตือนการจบการขายสำเร็จ
   */
  async expectOrderSuccess() {
    // ตรวจสอบข้อความแจ้งเตือนความสำเร็จ
    const successToast = this.page.getByText(/ยืนยันการชำระเงินและจบการขายสำเร็จ|สำเร็จ/i);
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // ตรวจสอบว่า Modal ปิดลงและตะกร้าแสดงข้อความว่าง
    await expect(this.paymentModal).not.toBeVisible();
    await expect(this.page.getByText('ยังไม่มีสินค้าในตะกร้า')).toBeVisible();
    await expect(this.cartRows).toHaveCount(0);
  }
}