export type ViewState = 'home' | 'scan' | 'excel' | 'po' | 'manual';

export interface Supplier {
  id: number;
  supplier_name: string;
  short_supplier_name: string;
}

export interface Product {
  id: number;
  product_name: string;
  product_code: string;
  category_name?: string;
  sub_category_name?: string;
  cost_price?: number;
}

export interface BillItemDTO {
  item_sequence: number;
  company_product_code: string;
  company_product_name: string;
  ai_product_code?: string;
  ai_product_name?: string;
  order_quantity: number;
  unit: string;
  conversion_factor: number;
  price_per_unit: number;
  discount_amount: number;
  net_amount: number;
  is_freebie: boolean;
  remark: string;
  product_id: number | null;
  category_id?: number | null;
  sub_category_id?: number | null;
}

export interface ScannedBillData {
  bill_no: string;
  total_amount: number;
  due_date: string;
  credit_term?: string;
  transport_by: string;
  supplier_id: number;
  supplier_name?: string;
  subtotal: number;
  discount_total: number;
  receive_date: string;
  vat_amount: number;
  grand_total: number;
  payment_status: string;
  items: BillItemDTO[];
  db_job_id: number;
  bill_image_id: number;
  filename?: string;
}

export interface SavedBill {
  id: number;
  bill_no: string;
  total_amount: number;
  due_date: string;
  credit_term?: string;
  transport_by: string;
  supplier_id: number;
  subtotal: number;
  discount_total: number;
  receive_date: string;
  vat_amount: number;
  grand_total: number;
  payment_status: string;
  is_verified: boolean;
  created_at: string;
  bill_image?: {
    id: number;
    image_url: string;
  };
  bill_items?: {
    id: number;
    bill_id: number;
    item_sequence: number;
    company_product_code: string;
    company_product_name: string;
    order_quantity: number;
    unit: string;
    conversion_factor: number;
    price_per_unit: number;
    discount_amount: number;
    net_amount: number;
    is_freebie: boolean;
    remark: string;
    product_id: number;
  }[];
}
