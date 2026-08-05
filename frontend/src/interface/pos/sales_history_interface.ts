// 3 อันแรก ใช้กับตารางภาพรวม
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

// 2 ตัวนี้ต่อท้าย ดูลายระเอียด

/** รายการสินค้าย่อยในบิล */
export interface SaleHistoryItemDetail {
  id: number;
  product_id: number;
  part_number: string;
  product_name: string;
  qty: number;
  unit: string;
  unit_price: number;
  discount_type: string;
  discount_value: number;
  discount_percent: number;
  discount_amount: number;
  final_unit_price: number;
  subtotal: number;
  allocated_bill_discount: number;
  net_subtotal: number;
  note: string;
}

/** รายละเอียดทั้งบิลเมื่อดึงตาม ID  */
export interface GetSaleHistoryByIDResponse {
  id: number;
  order_number: string;
  order_date: string;

  // ลูกค้าในตาราง
  customer_id?: number | null;
  customer_name: string;
  phone_number: string;

  // ขาจร
  customer_name_temp?: string | null;
  customer_phone_temp?: string | null;
  customer_type_name?: string; 
  address?: string;            

  subtotal: number;
  bill_discount_type: string;
  bill_discount_value: number;
  discount_amount: number;
  discount_percent: number;
  total_discount_items: number;
  total_amount: number;
  received_amount: number;
  paid_amount: number;
  balance_due: number;
  change_amount: number;

  due_date?: string | null;
  paid_date?: string | null;
  note: string;

  payment_method_name: string;
  payment_status: string;
  status: string;
  items: SaleHistoryItemDetail[];

  // ฟิลด์ข้อมูล Cancellation
  cancel_reason?: string | null;
  cancel_requested_at?: string | null;
  cancel_remark?: string | null;
  cancel_processed_at?: string | null;
}