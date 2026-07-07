export interface POItemResponse {
    id: number;
    product_id: number;
    product_name_snapshot: string;
    product_name_code_snapshot: string;
    quantity: number;
    unit: string;
    unit_price: number;
    sub_total: number;
}

export interface POResponse {
    id: number;
    order_number: string;
    supplier_name: string;
    total_amount: number;
    status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
    creator_name: string;
    created_at: Date;
    po_items: POItemResponse[];
}

export interface GetPOsResponse {
  data: POResponse[];
  total: number;
}

export interface GetPOsParams {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  date?: string;
}

export interface POSummaryResponse {
  pending_amount: number;
  approved_mtd_amount: number;
  rejected_mtd_amount: number;
  total_count: number;
}