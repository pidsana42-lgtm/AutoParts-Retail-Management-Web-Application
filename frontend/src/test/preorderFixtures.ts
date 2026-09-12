import type { PreOrder } from '../interface/pre-order/pre-order';
import type { Product } from '../interface/import';
import type { Catalog } from '../interface/catalog/catalog';

export const preorderCustomer = { id: 7, customer_name: 'สมชาย ใจดี', customer_phone: '0812345678' };
export const preorderProduct: Product = {
  id: 21, product_code: 'PART-21', product_name: 'กรองน้ำมัน', quantity: 0,
  sale_price: 150, retail_price: 180, company_product_code: 'SUP-21', supplier_name: 'ร้านอะไหล่ทดสอบ',
};
export const preorderCatalog: Catalog = {
  id: 31, catalog_code: 'CAT-31', catalog_name: 'แคตตาล็อกทดสอบ', brand: 'TEST', supplier_id: 1,
  supplier_name: 'ร้านอะไหล่ทดสอบ', is_active: true,
  catalog_items: [{ id: 41, part_number: 'CAT-PART-41', part_name: 'สายพานทดสอบ', standard_price: 250, unit: 'ชิ้น', st_no: 'ST-41' }],
};
export function preorder(overrides: Partial<PreOrder> = {}): PreOrder {
  return {
    id: 51, pre_order_type: 'WALK_IN', customer_id: 7, customer_name: 'สมชาย ใจดี',
    customer_phone: '0812345678', deposit_amount: 0, status: 'PENDING', supplier_id: 1,
    order_date: '2026-09-09T00:00:00Z',
    pre_order_items: [{ product_id: 21, product_name: 'กรองน้ำมัน', product_code: 'PART-21', quantity: 2, unit_price: 150, supplier_part_code: 'SUP-21', supplier_name: 'ร้านอะไหล่ทดสอบ' }],
    ...overrides,
  };
}
