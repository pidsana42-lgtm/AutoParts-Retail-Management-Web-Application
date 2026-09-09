import type { GetReturnsResponse, ReturnableSaleOrder, SalesReturn } from '../interface/return/return_interface';

export const returnableOrder: ReturnableSaleOrder = {
  id: 41, order_number: 'SO-TEST-0041', sold_at: '2026-09-01T09:00:00Z',
  customer_id: 8, customer_name: 'ลูกค้าทดสอบ', employee_name: 'พนักงานทดสอบ',
  items: [
    { product_id: 101, product_name: 'กรองน้ำมัน', product_code: 'FILTER-101', quantity: 3, unit_price: 150.25 },
    { product_id: 102, product_name: 'ผ้าเบรก', product_code: 'BRAKE-102', quantity: 1, unit_price: 299.5 },
  ],
};

export const salesReturn: SalesReturn = {
  id: 81, return_number: 'RTN-TEST-0081', original_order_id: 41,
  original_order: { order_number: 'SO-TEST-0041', customer: { customer_name: 'ลูกค้าทดสอบ', phone: '0812345678' } },
  return_date: '2026-09-09T09:00:00Z', requested_at: '2026-09-09T09:00:00Z',
  status: 'PENDING', reason: 'กรองน้ำมัน: ผิดรุ่น | ผ้าเบรก: ชำรุด',
  refund_amount: 600, refund_method: 'CASH',
  sales_return_items: [
    { product_id: 101, product_name: 'กรองน้ำมัน', product_code: 'FILTER-101', quantity: 2, unit_price: 150.25, subtotal: 300.5, reason: 'ผิดรุ่น' },
    { product_id: 102, product_name: 'ผ้าเบรก', product_code: 'BRAKE-102', quantity: 1, unit_price: 299.5, reason: 'ชำรุด' },
  ],
};

export const returnsResponse: GetReturnsResponse = {
  data: [
    { id: 81, return_number: 'RTN-TEST-0081', status: 'PENDING', refund_amount: 600, refund_method: 'CASH', requested_at: '2026-09-09T09:00:00Z', reason: 'ผิดรุ่น' },
    { id: 82, return_number: 'RTN-TEST-0082', status: 'APPROVED', refund_amount: 200, refund_method: 'TRANSFER', requested_at: '2026-09-09T09:00:00Z', reason: 'ชำรุด' },
  ],
  status_counts: [{ status: 'PENDING', count: 12 }, { status: 'APPROVED', count: 7 }, { status: 'REFUNDED', count: 3 }, { status: 'REJECTED', count: 1 }],
  total_count: 23, page: 1, page_size: 10,
};

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
