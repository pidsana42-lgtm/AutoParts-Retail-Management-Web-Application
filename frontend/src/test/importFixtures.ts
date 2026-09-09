import type { BillItemDTO, Product, SavedBill, ScannedBillData, Supplier } from '../interface/import';

export const importSupplier: Supplier = { id: 7, supplier_name: 'บริษัท อะไหล่ทดสอบ จำกัด', short_supplier_name: 'อะไหล่ทดสอบ' };
export const importProduct: Product = { id: 21, product_code: 'PART-21', product_name: 'กรองน้ำมัน', cost_price: 100 };
export const importItem: BillItemDTO = {
  item_sequence: 1, company_product_code: 'PART-21', company_product_name: 'กรองน้ำมัน',
  order_quantity: 2, unit: 'ชิ้น', conversion_factor: 1, price_per_unit: 100,
  discount_amount: 0, net_amount: 200, is_freebie: false, remark: '', product_id: 21,
};
export function scannedImport(overrides: Partial<ScannedBillData> = {}): ScannedBillData {
  return {
    bill_no: 'INV-TEST-001', total_amount: 214, due_date: '2026-10-09', credit_term: '30 Days',
    transport_by: 'ขนส่งทดสอบ', supplier_id: 7, supplier_name: importSupplier.supplier_name,
    subtotal: 200, discount_total: 0, receive_date: '2026-09-09', vat_amount: 14,
    grand_total: 214, payment_status: 'unpaid', items: [{ ...importItem }], db_job_id: 91, bill_image_id: 81,
    ...overrides,
  };
}
export function savedImport(overrides: Partial<SavedBill> = {}): SavedBill {
  const bill = scannedImport();
  return {
    bill_no: bill.bill_no, total_amount: bill.total_amount, due_date: bill.due_date,
    credit_term: bill.credit_term, transport_by: bill.transport_by, supplier_id: bill.supplier_id,
    subtotal: bill.subtotal, discount_total: bill.discount_total, receive_date: bill.receive_date,
    vat_amount: bill.vat_amount, grand_total: bill.grand_total, payment_status: bill.payment_status,
    id: 51, is_verified: false, created_at: '2026-09-09T00:00:00Z',
    bill_image: { id: 81, image_url: '/uploads/test-bill.jpg' },
    bill_items: bill.items.map(item => ({ ...item, id: 61, bill_id: 51, product_id: 21 })), ...overrides,
  };
}
