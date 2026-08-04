import type { CustomerDiscountResponse } from "./customer_interface";

export interface PosSession {
  customer: CustomerDiscountResponse | null;
  activeTypeId: number;
  paymentMethodId: number;
  billDiscountValue: number;
  billDiscountType: "none" | "percentage" | "amount";
  receivedAmount: number;
  receiverName: string;
  searchQuery: string;
  currentOrderId?: number | null;
  currentOrderNumber?: string | null;
  isPaymentModalOpen?: boolean;
}