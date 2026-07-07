export interface SalesReturnItem {
  id?: number;
  sales_return_id?: number;
  product_id: number;
  product_name?: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
}

export interface SalesReturn {
  id?: number;
  return_number?: string;
  original_order_id: number;
  return_date: string;
  reason: string;
  refund_amount: number;
  refund_method: string;
  requested_at: string;
  approved_at?: string;
  note?: string;
  created_by?: number;
  approved_by?: number;
  sales_return_items?: SalesReturnItem[];
}

export interface CustomerClaimItem {
  id?: number;
  customer_claim_id?: number;
  returned_item_id: number;
  product_id: number;
  qty: number;
  reason: string;
  resolution: string;
}

export interface CustomerClaim {
  id?: number;
  claim_no?: string;
  claim_date: string;
  original_order_id: number;
  return_id: number;
  created_by: number;
  approved_by?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string;
  customer_claim_items?: CustomerClaimItem[];
}

export interface SupplierClaimItem {
  id?: number;
  supplier_claim_id?: number;
  product_id: number;
  qty: number;
  reason: string;
}

export interface SupplierClaim {
  id?: number;
  claim_no?: string;
  claim_date: string;
  supplier_id: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string;
  supplier_claims_items?: SupplierClaimItem[];
}
