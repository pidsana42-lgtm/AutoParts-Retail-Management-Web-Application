export type ViewState = 'home' | 'scan' | 'excel' | 'mapping' | 'po' | 'manual' | 'approve';

export interface ExcelImportPreview {
  fileName: string;
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rows: any[][];
}

export interface ColumnMapping {
  code: string;
  name: string;
  quantity: string;
  unit: string;
  price: string;
}

export interface Supplier {
  id: number;
  supplier_name: string;
  short_supplier_name: string;
  supplier_address?: string;
  contact_line_sale?: string;
  phone_number_sale?: string;
  email_sale?: string;
  bank_account_number?: string;
}

export interface Product {
  id: number;
  product_name: string;
  product_code: string;
  part_number?: string;
  company_product_code?: string;
  quantity?: number;
  supplier_name?: string;
  suppliers?: Array<{
    supplier_id: number;
    supplier_name: string;
    quantity?: number;
    variant_code?: string;
  }>;
  category_name?: string;
  sub_category_name?: string;
  sub_sub_category_name?: string;
  cost_price?: number;
  sale_price?: number;
  retail_price?: number;
  image?: string;
  thumbnail_url?: string;
  image_url?: string;
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
  pre_order_item_id?: number | null;
  po_item_id?: number | null;
  category_id?: number | null;
  sub_category_id?: number | null;
  sub_sub_category_id?: number | null;
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
  po_id?: number | null;
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
  evidence_file_url?: string;
  bill_image?: {
    id: number;
    image_url: string;
  };
  bill_items?: {
    id: number;
    bill_id: number;
    po_item_id?: number | null;
    pre_order_item_id?: number | null;
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
    category_id?: number | null;
    sub_category_id?: number | null;
    sub_sub_category_id?: number | null;
  }[];
}
