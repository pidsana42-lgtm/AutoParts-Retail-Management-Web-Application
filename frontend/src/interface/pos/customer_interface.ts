// แมตช์ตาม GetCustomerDiscountResponse
export interface CustomerDiscountResponse {
  id: number;
  phone_number: string;
  customer_name: string;
  standard_discount_rate: number;
  is_discount_enabled: boolean;
  current_debt_amount: number;
  customer_type?: CustomerTypeInterface;
  ontop_discount_rate?: number; // สิทธิ์ส่วนลดพิเศษสำหรับกลุ่มอู่ซ่อมรถยนต์
  max_credit_limit: number;
  is_credit_enabled: boolean;
}

// แมตช์ตาม UpdateCustomerDiscountItemRequest
export interface UpdateCustomerDiscountItemRequest {
  id: number;
  standard_discount_rate: number;
  is_discount_enabled: boolean;
}

// แมตช์ตาม BulkUpdateCustomerDiscountRequest
export interface BulkUpdateCustomerDiscountRequest {
  discount_items: UpdateCustomerDiscountItemRequest[];
}
export interface CustomerTypeInterface {
  id: number;
  type_name: string;  // เช่น "GENERAL", "GARAGE", "WHOLESALE"
  type_label: string; // เช่น "ลูกค้าทั่วไป", "ลูกค้าอู่ซ่อมรถ", "ลูกค้าบริษัท"
}