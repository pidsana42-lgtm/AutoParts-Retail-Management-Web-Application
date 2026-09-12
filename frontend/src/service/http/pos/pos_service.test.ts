import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../apiClient';
import {
  posApiService,
  calculateValidatedDiscount,
  getDefaultProductDiscount,
} from './pos_service';
import type { CustomerDiscountResponse } from '../../../interface/pos/customer_interface';
import type { SaleOrderItemRequest } from '../../../interface/pos/pos_interface';

// mock apiClient ปลอม เพื่อให้สามารถทดสอบ posApiService ได้โดยไม่ต้องเรียก API จริง
vi.mock('../apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('pos_service', () => { // กลุ่มทดสอบสำหรับ pos_service เพื่อเก็บ test cases ทั้งหมดที่เกี่ยวข้องกับ pos_service
  beforeEach(() => {
    vi.resetAllMocks(); // รีเซ็ต mock ทั้งหมดก่อนแต่ละ test case เพื่อให้แน่ใจว่าไม่มีผลกระทบจาก test case ก่อนหน้า
    vi.spyOn(console, 'error').mockImplementation(() => {}); // ปิดการทำงานของ console.error เพื่อไม่ให้แสดง error log ใน console ขณะรัน test
    if (typeof window !== 'undefined') { // ตรวจสอบว่า window object มีอยู่ (เพื่อให้แน่ใจว่าโค้ดนี้รันใน environment ที่มี
      vi.spyOn(window, 'alert').mockImplementation(() => {});
    }
  });

  // functions จำลองสำหรับสร้าง สินค้าเริ่มต้นและลูกค้าเริ่มต้น เพื่อใช้ในการทดสอบ
  const createDummyItem = (overrides: Partial<SaleOrderItemRequest> = {}): SaleOrderItemRequest => ({
    product_id: 1,
    product_code: 'P-001',
    product_name: 'Test Part',
    qty: 1,
    unit_price: 100,
    discount_type: 'none',
    discount_value: 0,
    ...overrides,
  });

  const createDummyCustomer = (overrides: Partial<CustomerDiscountResponse> = {}): CustomerDiscountResponse => ({
    id: 1,
    customer_name: 'ลูกค้าทั่วไป',
    phone_number: '0812345678',
    standard_discount_rate: 0,
    is_discount_enabled: true,
    current_debt_amount: 0,
    max_credit_limit: 50000,
    is_credit_enabled: true,
    ...overrides,
  });

  // ===========================================================================
  // 1. Business Logic Helpers: calculateValidatedDiscount 
  // ทดสอบฟังก์ชัน calculateValidatedDiscount เพื่อให้แน่ใจว่าการคำนวณส่วนลดถูกต้องตามเงื่อนไขต่างๆ
  // ===========================================================================
  describe('calculateValidatedDiscount', () => {
    it('blocks all discounts for WHOLESALE customer (type ID 3)', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const item = createDummyItem({
        discount_type: 'percentage',
        discount_value: 5,
      });
      const customer = createDummyCustomer({
        id: 1,
        customer_name: 'บริษัท ขายส่ง จำกัด',
        customer_type: { id: 3, type_name: 'WHOLESALE', type_label: 'บริษัท' },
      });

      const result = calculateValidatedDiscount(item, 5, customer);
      expect(result).toBe(0);
      expect(alertSpy).toHaveBeenCalledWith('ลูกค้ากลุ่มบริษัทไม่ได้รับสิทธิ์ส่วนลดใดๆ ทั้งสิ้น');
    });

    it('blocks all discounts for WHOLESALE customer by type_name', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const item = createDummyItem({
        discount_type: 'percentage',
        discount_value: 5,
      });
      const customer = createDummyCustomer({
        id: 1,
        customer_name: 'บริษัท ทั่วไป',
        customer_type: { id: 99, type_name: 'WHOLESALE', type_label: 'บริษัท' },
      });

      const result = calculateValidatedDiscount(item, 5, customer);
      expect(result).toBe(0);
      expect(alertSpy).toHaveBeenCalled();
    });

    it('allows valid percentage discount within product ceiling for general customer', () => {
      const item = createDummyItem({
        unit_price: 200,
        discount_type: 'percentage',
        discount_value: 4,
        max_discount_rate: 5.0,
      });

      const result = calculateValidatedDiscount(item, 4, null);
      expect(result).toBe(4);
    });

    it('blocks percentage discount exceeding product ceiling', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const item = createDummyItem({
        unit_price: 200,
        discount_type: 'percentage',
        discount_value: 10,
        max_discount_rate: 5.0,
      });

      const result = calculateValidatedDiscount(item, 10, null);
      expect(result).toBe(0);
      expect(alertSpy).toHaveBeenCalledWith('เกินข้อกำหนดสูงสุด (จำกัดที่ 5.00%)');
    });

    it('expands ceiling with Ontop discount for GARAGE customer', () => {
      const item = createDummyItem({
        unit_price: 500,
        discount_type: 'percentage',
        discount_value: 7,
        max_discount_rate: 5.0, // base 5% + ontop 3% = 8% allowed
      });

      const customer = createDummyCustomer({
        id: 10,
        customer_name: 'อู่ช่างชาติ',
        customer_type: { id: 2, type_name: 'GARAGE', type_label: 'อู่ซ่อมรถ' },
        is_discount_enabled: true,
        ontop_discount_rate: 3.0,
      });

      const result = calculateValidatedDiscount(item, 7, customer);
      expect(result).toBe(7);
    });

    it('blocks GARAGE discount if exceeding expanded ceiling', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const item = createDummyItem({
        unit_price: 500,
        discount_type: 'percentage',
        discount_value: 10, // 10% > 5% + 3% = 8%
        max_discount_rate: 5.0,
      });

      const customer = createDummyCustomer({
        id: 10,
        customer_name: 'อู่ช่างชาติ',
        customer_type: { id: 2, type_name: 'GARAGE', type_label: 'อู่ซ่อมรถ' },
        is_discount_enabled: true,
        ontop_discount_rate: 3.0,
      });

      const result = calculateValidatedDiscount(item, 10, customer);
      expect(result).toBe(0);
      expect(alertSpy).toHaveBeenCalledWith('เกินข้อกำหนดสูงสุด (จำกัดที่ 8.00%)');
    });

    it('allows valid amount discount within ceiling in Baht', () => {
      // 1000 baht item, max rate 10% -> max 100 baht
      const item = createDummyItem({
        unit_price: 1000,
        discount_type: 'amount',
        discount_value: 80,
        max_discount_rate: 10.0,
      });

      const result = calculateValidatedDiscount(item, 80, null);
      expect(result).toBe(80);
    });

    it('blocks amount discount exceeding ceiling in Baht', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const item = createDummyItem({
        qty: 2,
        unit_price: 500, // Total 1000, max 5% = 50 baht
        discount_type: 'amount',
        discount_value: 80,
        max_discount_rate: 5.0,
      });

      const result = calculateValidatedDiscount(item, 80, null);
      expect(result).toBe(0);
      expect(alertSpy).toHaveBeenCalledWith('เกินข้อกำหนดสูงสุด (จำกัดที่ ฿50.00)');
    });

    it('returns 0 for unknown discount type', () => {
      const item = createDummyItem({
        discount_type: 'none',
        discount_value: 0,
      });
      expect(calculateValidatedDiscount(item, 10, null)).toBe(0);
    });
  });

  // ===========================================================================
  // 2. Business Logic Helpers: getDefaultProductDiscount
  // ===========================================================================
  describe('getDefaultProductDiscount', () => {
    it('returns none for WHOLESALE customer', () => {
      const customer = createDummyCustomer({
        id: 1,
        customer_type: { id: 3, type_name: 'WHOLESALE' },
      });
      const result = getDefaultProductDiscount({ max_discount_rate: 10 }, customer);
      expect(result).toEqual({ type: 'none', value: 0 });
    });

    it('returns none for guest / walk-in customer', () => {
      expect(getDefaultProductDiscount({ max_discount_rate: 10 }, null)).toEqual({
        type: 'none',
        value: 0,
      });
      expect(
        getDefaultProductDiscount({ max_discount_rate: 10 }, createDummyCustomer({ id: 0 }))
      ).toEqual({
        type: 'none',
        value: 0,
      });
    });

    it('returns base rate + ontop rate for GARAGE customer with enabled discount', () => {
      const customer = createDummyCustomer({
        id: 5,
        customer_type: { id: 2, type_name: 'GARAGE', type_label: 'อู่' },
        is_discount_enabled: true,
        ontop_discount_rate: 3.0,
      });
      const product = { max_discount_rate: 5.0 };

      const result = getDefaultProductDiscount(product, customer);
      expect(result).toEqual({ type: 'percentage', value: 8.0 });
    });

    it('returns standard discount rate for regular customer with standard_discount_rate', () => {
      const customer = createDummyCustomer({
        id: 7,
        customer_type: { id: 1, type_name: 'GENERAL' },
        is_discount_enabled: true,
        standard_discount_rate: 4.0,
      });
      const product = { max_discount_rate: 10.0 };

      const result = getDefaultProductDiscount(product, customer);
      expect(result).toEqual({ type: 'percentage', value: 4.0 });
    });

    it('caps standard discount rate by product max discount rate', () => {
      const customer = createDummyCustomer({
        id: 7,
        customer_type: { id: 1, type_name: 'GENERAL' },
        is_discount_enabled: true,
        standard_discount_rate: 8.0, // standard is 8%, but product allows only 5%
      });
      const product = { max_discount_rate: 5.0 };

      const result = getDefaultProductDiscount(product, customer);
      expect(result).toEqual({ type: 'percentage', value: 5.0 });
    });

    it('returns none if customer has discount disabled', () => {
      const customer = createDummyCustomer({
        id: 5,
        customer_type: { id: 2, type_name: 'GARAGE' },
        is_discount_enabled: false,
        ontop_discount_rate: 3.0,
      });
      const result = getDefaultProductDiscount({ max_discount_rate: 5 }, customer);
      expect(result).toEqual({ type: 'none', value: 0 });
    });
  });

  // ===========================================================================
  // 3. API Services: posApiService
  // ===========================================================================
  describe('posApiService', () => {
    it('getStoreConfig and getStoreConfigAuditLogs', async () => {
      const config = { max_credit: 50000, max_overdue_days: 30 };
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: config });
      await expect(posApiService.getStoreConfig()).resolves.toEqual(config);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/store-config');

      const logs = [{ id: 1, action: 'edit' }];
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: logs });
      await expect(posApiService.getStoreConfigAuditLogs()).resolves.toEqual(logs);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/store-config/audit-logs');
    });

    it('createStoreConfig and updateStoreConfig', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { message: 'created' } });
      await expect(posApiService.createStoreConfig({ max_credit: 10000 })).resolves.toEqual({
        message: 'created',
      });
      expect(apiClient.post).toHaveBeenCalledWith('/pos/store-config', { max_credit: 10000 });

      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { message: 'updated' } });
      await expect(posApiService.updateStoreConfig({ max_credit: 20000 })).resolves.toEqual({
        message: 'updated',
      });
      expect(apiClient.put).toHaveBeenCalledWith('/pos/store-config', { max_credit: 20000 });
    });

    it('searchCustomerDiscount returns data on success and empty array on error', async () => {
      const customers = [{ id: 1, customer_name: 'อู่ทดสอบ' }];
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: customers });
      await expect(posApiService.searchCustomerDiscount('อู่')).resolves.toEqual(customers);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/customer-discount?search=%E0%B8%AD%E0%B8%B9%E0%B9%88');

      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network error'));
      await expect(posApiService.searchCustomerDiscount('fail')).resolves.toEqual([]);
    });

    it('searchProducts encodes query param', async () => {
      const products = [{ id: 1, product_name: 'Brake Pad' }];
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: products });
      await expect(posApiService.searchProducts('ผ้าเบรค')).resolves.toEqual(products);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/products?q=%E0%B8%9C%E0%B9%89%E0%B8%B2%E0%B9%80%E0%B8%9A%E0%B8%A3%E0%B8%84');
    });

    it('createPOSOrder and updatePOSOrder', async () => {
      const orderReq = { customer_id: 1, items: [] } as any;
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { order_number: 'INV001' } });
      await expect(posApiService.createPOSOrder(orderReq)).resolves.toEqual({ order_number: 'INV001' });
      expect(apiClient.post).toHaveBeenCalledWith('/pos/orders', orderReq);

      const updateReq = { items: [] } as any;
      vi.mocked(apiClient.put).mockResolvedValueOnce({ data: { message: 'updated' } });
      await expect(posApiService.updatePOSOrder('INV001', updateReq)).resolves.toEqual({ message: 'updated' });
      expect(apiClient.put).toHaveBeenCalledWith('/pos/orders/INV001', updateReq);
    });

    it('getCustomerTypes and getPaymentMethods', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [{ id: 1, type_name: 'GENERAL' }] });
      await expect(posApiService.getCustomerTypes()).resolves.toEqual([{ id: 1, type_name: 'GENERAL' }]);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/customer-types');

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [{ id: 1, method_name: 'CASH' }] });
      await expect(posApiService.getPaymentMethods()).resolves.toEqual([{ id: 1, method_name: 'CASH' }]);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/payment-methods');
    });

    it('generatePromptPayQR and confirmPayment', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { qr_code: 'raw_qr' } });
      await expect(posApiService.generatePromptPayQR(42, 1)).resolves.toEqual({ qr_code: 'raw_qr' });
      expect(apiClient.post).toHaveBeenCalledWith('/pos/payments/generate-qr', {
        order_id: 42,
        received_by_id: 1,
      });

      vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: { status: 'paid' } });
      await expect(posApiService.confirmPayment({ payment_id: 10 } as any)).resolves.toEqual({
        status: 'paid',
      });
      expect(apiClient.patch).toHaveBeenCalledWith('/pos/payments/confirm', { payment_id: 10 });
    });

    it('sales history endpoints', async () => {
      const historyData = { items: [], total: 0 };
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: historyData } });
      await expect(posApiService.getSalesHistory({ page: 1, limit: 10 })).resolves.toEqual(historyData);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/sales/history', { params: { page: 1, limit: 10 } });

      const detailData = { id: 1, order_number: 'INV01' };
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { data: detailData } });
      await expect(posApiService.getSalesHistoryById(1)).resolves.toEqual(detailData);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/sales-history/1');
    });

    it('order cancellation flow (request, approve, reject, revert)', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { message: 'requested' } });
      await expect(posApiService.requestCancelSaleOrder(5, { reason: 'Wrong item' })).resolves.toEqual({
        message: 'requested',
      });
      expect(apiClient.post).toHaveBeenCalledWith('/pos/sales-history/5/request-cancel', {
        reason: 'Wrong item',
      });

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { message: 'approved' } });
      await expect(posApiService.approveCancelSaleOrder(5)).resolves.toEqual({ message: 'approved' });
      expect(apiClient.post).toHaveBeenCalledWith('/pos/sales-history/5/approve-cancel', {});

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { message: 'rejected' } });
      await expect(posApiService.rejectCancelSaleOrder(5, { remark: 'Denied' })).resolves.toEqual({
        message: 'rejected',
      });
      expect(apiClient.post).toHaveBeenCalledWith('/pos/sales-history/5/reject-cancel', { remark: 'Denied' });

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { message: 'reverted' } });
      await expect(posApiService.revertCancellationRequest(5)).resolves.toEqual({ message: 'reverted' });
      expect(apiClient.post).toHaveBeenCalledWith('/pos/sales-history/5/cancel-request/revert');
    });

    it('unpaid bills and debt settlement', async () => {
      const bills = { unpaid_orders: [] };
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: bills });
      await expect(posApiService.getUnpaidBillsByCustomer(10)).resolves.toEqual(bills);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/payments/unpaid-bills/10');

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: bills });
      await expect(posApiService.getUnpaidBillByOrderNumber('INV-999')).resolves.toEqual(bills);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/payments/unpaid-order/INV-999');

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true } });
      await expect(posApiService.settleCustomerBills({ customer_id: 10 } as any)).resolves.toEqual({
        success: true,
      });
      expect(apiClient.post).toHaveBeenCalledWith('/pos/payments/settle-bills', { customer_id: 10 });

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { qr_raw: 'sample' } });
      await expect(posApiService.generateSettleQR({ customer_id: 10 } as any)).resolves.toEqual({
        qr_raw: 'sample',
      });
      expect(apiClient.post).toHaveBeenCalledWith('/pos/payments/generate-settle-qr', { customer_id: 10 });
    });

    it('payment history and receipt cancellation flow', async () => {
      const history = [{ id: 1, amount: 500 }];
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: history });
      await expect(posApiService.getPaymentHistory()).resolves.toEqual(history);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/payments/history', { params: undefined });

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { message: 'requested' } });
      await expect(
        posApiService.requestCancelPaymentReceipt(1, { reason: 'mistake' } as any)
      ).resolves.toEqual({ message: 'requested' });

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { message: 'reverted' } });
      await expect(posApiService.revertCancelPaymentReceiptRequest(1)).resolves.toEqual({
        message: 'reverted',
      });

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { message: 'approved' } });
      await expect(posApiService.approveCancelPaymentReceipt(1)).resolves.toEqual({
        message: 'approved',
      });

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { message: 'rejected' } });
      await expect(posApiService.rejectCancelPaymentReceipt(1)).resolves.toEqual({
        message: 'rejected',
      });

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { message: 'cancelled' } });
      await expect(posApiService.cancelPaymentReceipt(1, { reason: 'direct' } as any)).resolves.toEqual({
        message: 'cancelled',
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [{ id: 9 }] });
      await expect(posApiService.getCancelledPaymentHistory()).resolves.toEqual([{ id: 9 }]);
    });

    it('getSaleOrderByNumber tries multiple endpoints until found', async () => {
      // First endpoint fails, second succeeds
      vi.mocked(apiClient.get)
        .mockRejectedValueOnce(new Error('not found in claims'))
        .mockResolvedValueOnce({ data: { data: { id: 10, order_number: 'INV-10' } } });

      const result = await posApiService.getSaleOrderByNumber('INV-10');
      expect(result).toEqual({ id: 10, order_number: 'INV-10' });
      expect(apiClient.get).toHaveBeenCalledWith('/claims/sale-orders/number/INV-10');
      expect(apiClient.get).toHaveBeenCalledWith('/pos/orders/number/INV-10');
    });

    it('getSaleOrderByNumber returns null if all endpoints fail', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      const result = await posApiService.getSaleOrderByNumber('INV-404');
      expect(result).toBeNull();
    });

    it('PDF print endpoints return Blob data', async () => {
      const dummyBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: dummyBlob });
      await expect(posApiService.printOrderReceipt(1, 'ใบเสร็จรับเงิน')).resolves.toBe(dummyBlob);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/sales-history/1/print', {
        params: { title: 'ใบเสร็จรับเงิน' },
        responseType: 'blob',
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: dummyBlob });
      await expect(posApiService.printPaymentReceiptPDF(99)).resolves.toBe(dummyBlob);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/payments/history/99/pdf', {
        responseType: 'blob',
      });

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: dummyBlob });
      await expect(
        posApiService.printCustomerStatementPDF(12, '2026-01-01', '2026-01-31')
      ).resolves.toBe(dummyBlob);
      expect(apiClient.get).toHaveBeenCalledWith('/pos/payments/customers/12/statement-pdf', {
        params: {
          start_date: '2026-01-01',
          end_date: '2026-01-31',
          payment_type: undefined,
          status: undefined,
          payment_method: undefined,
        },
        responseType: 'blob',
      });
    });
  });
});
