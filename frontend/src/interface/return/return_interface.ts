export type ReturnStatus = 'PENDING' | 'APPROVED' | 'REFUNDED' | 'REJECTED';

export interface ReturnStatusCount {
  status: ReturnStatus;
  count: number;
}

export interface ReturnListItem {
  id: number;
  return_number: string;
  original_order_id?: number;
  status: ReturnStatus;
  reason?: string;
  refund_amount: number;
  refund_method?: string;
  requested_at: string;
  approved_at?: string;
  refunded_at?: string;
  note?: string;
}

export interface ReturnLineItem {
  product_id: number;
  product_name: string;
  product_code: string;
  purchasedQty: number;
  unit_price: number;
  checked: boolean;
  returnQty: number;
  reason: string;
  reasons: string[];
  condition: string;
  conditions: string[];
}

export interface GetReturnsParams {
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface GetReturnsResponse {
  data: ReturnListItem[];
  status_counts: ReturnStatusCount[];
  total_count: number;
  page: number;
  page_size: number;
}

// ==========================================
// สำหรับหน้า "สร้างรายการคืนสินค้าใหม่"
// ค้นหาใบขาย/ใบเสร็จเพื่อดึงรายการสินค้าที่คืนได้ (แยกจากการค้นหาใบขายฝั่ง Claim)
// ==========================================
export interface ReturnableSaleOrderItem {
  product_id: number;
  product_name: string;
  product_code: string;
  quantity: number; // จำนวนที่ซื้อในใบขายนี้
  unit_price: number;
}

export interface ReturnableSaleOrder {
  id: number;
  order_number: string;
  sold_at: string;
  customer_id?: number;
  customer_name?: string;
  employee_name?: string;
  items: ReturnableSaleOrderItem[];
}

export interface SalesReturnItem {
  id?: number;
  sales_return_id?: number;
  product_id: number;
  product_name?: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
  reason: string;
}

export interface SalesReturn {
  id?: number;
  return_number?: string;
  original_order_id: number;
  original_order?: any;
  return_date: string;
  status?: ReturnStatus;
  reason: string;
  refund_amount: number;
  refund_method: string;
  requested_at: string;
  approved_at?: string;
  refunded_at?: string;
  refunded_by?: number;
  note?: string;
  created_by?: number;
  created_by_user?: any;
  approved_by?: number;
  approved_by_user?: any;
  sales_return_items?: SalesReturnItem[];
  items?: SalesReturnItem[];
}
