// แมตช์ตาม GetCustomerDiscountResponse
export interface CustomerDiscountResponse {
  customer_id: number;
  customer_name: string;
  standard_discount_rate: number;
  is_discount_enabled: boolean;
  current_debt_amount: number;
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