// 3 อันแรก ใช้กับตารางภาพรวม
export interface SalesHistoryFilterRequest {
  search?: string;
  start_date?: string; // ปรับเป็น camelCase/snake_case ตาม Query Param ที่ Go อ่าน
  end_date?: string;
  customer_type?: string;
  payment_method?: string;
  status?: string;
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

  // เพิ่มฟิลด์ประเภทลูกค้า และ ที่อยู่
  customer_type_name?: string;
  address?: string;

  subtotal: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;

  payment_method_name: string;
  status: string;
  payment_status: string;

  // เพิ่มฟิลด์ข้อมูลการยกเลิก (Cancellation)
  cancel_reason?: string | null;
  cancel_requested_at?: string | null;
  cancel_remark?: string | null;
  cancel_processed_at?: string | null;
  canceller?: string;
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

/** Request Payload สำหรับพนักงานส่งคำขอยกเลิก */
export interface RequestCancelOrderRequest {
  reason: string;
}

/** Request Payload สำหรับเจ้าของร้านอนุมัติ หรือ ปฏิเสธ */
export interface ProcessCancelOrderRequest {
  remark?: string;
}

/** สำหรับรายการคำขอยกเลิกบิล (กรณีใช้ Response Type เฉพาะ) */
export interface CancellationRequestItem {
  id: number;
  order_number: string;
  order_date: string;
  customer_name: string;
  customer_name_temp?: string | null;
  total_amount: number;
  status: string; // เช่น "PENDING_CANCEL", "CANCELLED", "COMPLETED"
  cancel_reason?: string | null;
  cancel_requested_at?: string | null;
  cancel_remark?: string | null;
  cancel_processed_at?: string | null;
  canceller?: string;
}