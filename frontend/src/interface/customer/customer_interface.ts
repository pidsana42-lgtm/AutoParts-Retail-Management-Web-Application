// ==================== Customer Types ====================
export interface CustomerTypeItem {
  id: number;
  type_name: string;   // เช่น "GENERAL", "GARAGE", "WHOLESALE"
  type_label: string;  // เช่น "ลูกค้าทั่วไป", "ลูกค้าอู่ซ่อมรถ", "ลูกค้าบริษัท"
}

// ==================== Requests (Payloads) ====================
export interface RegisterCustomerRequest {
  customer_name: string;
  customer_type_id: number;
  phone_number: string;
  id_card_number_customer: string;
  registered_address: string;
  shipping_address: string;
}

export interface UpdateCustomerDiscountRequest {
  is_discount_enabled: boolean;
  ontop_discount_rate: number;
  credit_limit?: number;
  standard_discount_rate?: number;
}

// ==================== Responses ====================
export interface CustomerListItem {
  id: number;
  customer_name: string;
  phone_number: string;
  id_card_number_customer: string;
  display_address: string;
  customer_type_label: string;
  current_debt_amount: number;
  max_credit_limit: number;
  is_discount_enabled: boolean;
  standard_discount_rate: number;
  ontop_discount_rate: number;
  customer_type: CustomerTypeItem;
}

export interface CustomerDetailResponse {
  id: number;
  customer_name: string;
  customer_type_id: number;
  customer_type_label: string;
  credit_limit: number;
  phone_number: string;
  id_card_number_customer: string;
  id_card_image_path: string;
  registered_address: string;
  shipping_address: string;
  current_balance: number;
  standard_discount_rate: number;
  current_debt_amount: number;
  is_discount_enabled: boolean;
  ontop_discount_rate: number;
}