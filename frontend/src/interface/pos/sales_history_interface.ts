export interface SalesHistoryFilterRequest {
  search?: string;
  start_date?: string; // ปรับเป็น camelCase/snake_case ตาม Query Param ที่ Go อ่าน
  end_date?: string;
  customer_type?: string;
  payment_method?: string;
  page?: number;
  limit?: number;
}

export interface SalesHistoryItemResponse {
  id: number;
  order_number: string;
  order_date: string; // ISO String จาก time.Time ของ Go
  created_at: string;

  // ลูกค้าในระบบ
  customer_id?: number | null;
  customer_name: string;
  phone_number: string;

  // ขาจร (Guest)
  customer_name_temp?: string | null;
  customer_phone_temp?: string | null;

  subtotal: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;

  payment_method_name: string;
  status: string;
  payment_status: string;
}

export interface SalesHistoryPaginationResponse {
  items: SalesHistoryItemResponse[];
  page: number;
  limit: number;
  total_rows: number;
  total_pages: number;
}