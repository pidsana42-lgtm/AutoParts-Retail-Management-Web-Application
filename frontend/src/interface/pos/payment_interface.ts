export interface ConfirmPaymentRequest {
  payment_id?: number;
  order_id: number;
  payment_method_id: number;
  received_amount: number;
  received_by_id: number;
}

export interface PaymentHistoryItem {
  receipt_id: number;
  receipt_number: string;
  paid_at: string;
  customer_name: string;
  payment_method: string;
  order_numbers: string;
  total_received: number;
  status: "completed" | "pending_cancel" | "cancelled" | string;
  received_by_id?: number;
  received_by_name: string;
  payment_type: "payment" | "repayment";
  cancel_reason?: string;
  cancel_requested_by_id?: number;
  cancel_requested_by_name?: string;
  cancel_requested_at?: string;
  cancel_remark?: string;
}

export interface RequestCancelPaymentReceiptRequest {
  reason: string;
}

export interface ProcessCancelPaymentReceiptRequest {
  remark?: string;
}

export interface CancelPaymentReceiptRequest {
  cancelled_by_id: number;
  reason: string;
  payment_type: "payment" | "repayment";
}

export interface CancelledPaymentItem {
  receipt_id: number;
  receipt_number: string;
  original_paid_at: string;
  customer_name: string;
  total_amount: number;
  cancelled_at?: string;
  cancelled_by_name: string;
  cancel_reason: string;
}