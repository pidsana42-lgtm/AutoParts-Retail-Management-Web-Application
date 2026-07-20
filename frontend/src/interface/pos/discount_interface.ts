import type { CustomerDiscountResponse } from "./customer_interface";

export interface ValidateDiscountPolicyProps {
  rawValue: number;
  discountType: "none" | "percentage" | "amount" | string | any;             
  unitPrice: number;
  qty: number;
  maxDiscountRate?: number | null; 
  customer: CustomerDiscountResponse | null;
  activeTypeId: number;
}

export interface DiscountPolicyResult {
  isValid: boolean;
  errorMsg?: string;
}