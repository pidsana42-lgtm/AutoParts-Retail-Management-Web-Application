export interface ConfirmPaymentRequest {
  payment_id?: number;
  order_id: number;
  payment_method_id: number;
  received_amount: number;
  received_by_id: number;
}