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
  returned_item_id?: number;
  product_id: number;
  product_name?: string;
  qty: number;
  unit_price?: number;
  reason: string;
  resolution: string;
  status?: string;
  claim_type?: 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT';
  evidence_url?: string;
  // fields สำหรับติดตามการส่งมอบ
  item_given?: boolean;        // ให้ของไปแล้วหรือยัง
  given_from?: 'STOCK' | 'SUPPLIER' | null; // เอาจากสต็อกร้าน หรือรอบริษัท
}

export interface CustomerClaim {
  id?: number;
  claim_no?: string;
  claim_date: string;
  original_order_id: number;
  customer_name?: string;
  customer_phone?: string;
  claim_type?: 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT';
  claim_amount?: number;
  refund_amount?: number;
  replacement_cost?: number;
  return_id: number;
  created_by: number;
  approved_by?: number;
  approved_at?: string;
  status: string;
  notes?: string;
  note?: string;
  items?: CustomerClaimItem[];
  // fields ใหม่สำหรับติดตามสถานะการดำเนินงาน
  supplier_response_status?: 'WAITING' | 'APPROVED' | 'REJECTED' | null; // สถานะตอบกลับจากบริษัท
  customer_received_item?: boolean;  // ลูกค้าได้รับของแล้วหรือยัง
  customer_waiting?: boolean;        // ลูกค้ารอผลก่อน (ไม่ได้รับของไป)
  operation_note?: string;           // บันทึกการดำเนินงาน
  updated_by_name?: string;          // ชื่อผู้อัพเดทล่าสุด
  updated_at?: string;               // เวลาอัพเดทล่าสุด
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

// ==========================================
// Claim Types & UI Interfaces
// ==========================================
export type ClaimType = 'INSTANT' | 'SUPPLIER_PENDING' | 'CREDIT_ACCOUNT';
export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type TrackingStage = 'WAITING_SEND' | 'SENT_TO_SUPPLIER' | 'REPLACEMENT_RECEIVED' | 'COMPLETED';
export type TrackingFilter = 'ALL' | TrackingStage;

export interface ClaimFormProduct {
  product_id: number;
  product_name: string;
  price: number;
  sold_qty: number;
  claim_qty: number;
  reason: string;
  claim_type?: ClaimType;
  evidenceFile: File | null;
  evidencePreview: string | null;
}

export interface FlatRow {
  claimId: number;
  claimNo: string;
  claimDate: string;
  customerName: string;
  customerPhone: string;
  claimType: ClaimType;
  itemClaimType: ClaimType;
  isFirst: boolean;
  totalItems: number;
  itemId: number;
  productName: string;
  qty: number;
  reason: string;
  resolution: string;
  itemStatus: string;
  rawClaim: CustomerClaim;
}

export interface ClaimsPageProps {
  canApprove?: boolean;
}

export interface ClaimTrackingTabProps {
  rawClaims: CustomerClaim[];
  loading: boolean;
  basePath: string;
  onUpdateStage: (itemId: number, newStage: string) => Promise<void>;
  updatingItemId: number | null;
  trackingSearch: string;
  trackingFilter: TrackingFilter;
}

