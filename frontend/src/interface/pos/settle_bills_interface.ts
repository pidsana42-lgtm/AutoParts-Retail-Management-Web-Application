export interface UnpaidBillItem {
  order_id: number;
  order_number: string;
  order_date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  payment_status: string; // "unpaid" | "partial"
  customer_name?: string;
  customer_type?: string;
  customer_phone?: string;
  payment_method?: string;
}

export interface CustomerUnpaidBillsResponse {
  customer_id: number;
  customer_name: string;
  total_debt: number;
  bills: UnpaidBillItem[];
}

export interface SettleBillAllocation {
  order_id: number;
  pay_amount: number;
}

export interface SettleBillsRequest {
  customer_id: number;
  received_by_id: number;
  payment_method_id: number;
  total_received: number;
  transaction_ref?: string;
  allocations: SettleBillAllocation[];
}

export interface SettleBillsResponse {
  receipt_id: number;
  receipt_number: string;
  customer_id: number;
  total_received: number;
  settled_bills_count: number;
  paid_at: string;
}