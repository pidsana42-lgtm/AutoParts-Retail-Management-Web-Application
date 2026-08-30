export interface CustomerTypeInterface {
  id: number;
  type_name: string;   // เช่น "GENERAL", "GARAGE", "WHOLESALE"
  type_label?: string; // เช่น "ลูกค้าทั่วไป", "ลูกค้าอู่ซ่อมรถ", "ลูกค้าบริษัท"
}

/**
 * ─── RESPONSES ───
 */

// แมตช์ตาม GetCustomerDiscountResponse (API ข้อมูลดิบจาก Backend)
export interface CustomerDiscountResponse {
  id: number;
  customer_id?: number;
  phone_number: string;
  customer_name: string;
  id_card_number_customer?: string;
  standard_discount_rate: number;
  is_discount_enabled: boolean;
  current_debt_amount: number;
  customer_type?: CustomerTypeInterface; // เชื่อมโยงข้อมูลประเภทลูกค้าด้านบน
  ontop_discount_rate?: number;           // สิทธิ์ส่วนลดพิเศษสำหรับกลุ่มอู่ซ่อมรถยนต์
  max_credit_limit: number;
  is_credit_enabled: boolean;
  shipping_address?: string;
  registered_address?: string;
  display_address?: string;
  address?: string;
}

// ข้อมูลลูกค้าที่ผ่านการคำนวณและแปลง Format พร้อมใช้บน UI (จาก Custom Hook)
export interface ComputedCustomerData {
  customerName: string;
  phoneNumber: string;
  isGuest: boolean;
  isSpecialPrice: boolean;
  isDiscountEnabled: boolean;
  ontopDiscountRate: number;
  creditUsagePercentage: number;
  currentDebtStr: string;
  remainingCreditStr: string;
  maxCreditLimitStr: string;
  raw: CustomerDiscountResponse | null;
}

/**
 * ─── REQUESTS (API Payloads) ───
 */

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