// -----------------------------------------
// SHARED & COMMON INTERFACES (ส่วนที่ใช้งานร่วมกัน)
// -----------------------------------------

// ดึงข้อมูล Supplier มาแสดง
export interface SupplierResponse {
    id: number;
    supplier_name: string;
}

// เสิร์ช กรองเอาเฉพาะของบริษัทที่เลือกเท่านั้น
export interface ProductSearchResponse {
    id: number;
    code: string;
    supply_product_code: string;
    barcode: string;
    name: string;
    price: number;
    unit: string;
    stock_qty: number;
}

// ข้อมูลรายการสินค้าพื้นฐาน
export interface POItemResponse {
    id: number;
    product_id: number;
    product_name_snapshot: string;
    product_code_snapshot: string;
    supply_product_code_snapshot: string;
    quantity: number;
    unit: string;
    unit_price: number;
    sub_total: number;
    order_type: string;

    alert_id?: number;
    pre_order_item_id?: number;
}

// ข้อมูลที่เพิ่ม type เพื่อใช้จัดการ State ภายในหน้าเว็บ
export type LocalPOItem = POItemResponse & { 
    order_type: 'สั่งซื้อ' | 'พรีออเดอร์';
    pre_order_item_id?: number;
};

// -----------------------------------------
// CREATE PURCHASE ORDER (ส่วนการสร้างใบสั่งซื้อใหม่)
// -----------------------------------------

export interface CreatePOItemRequest {
    product_id: number;
    quantity: number;
    unit_price: number;
    notes?: string;
    alert_id?: number;
    pre_order_item_id?: number;
}

export interface CreatePORequest {
    supplier_id: number;
    notes?: string;
    status: 'DRAFT' | 'PENDING';
    po_items: CreatePOItemRequest[];
}

export interface CreatePOItemResponse {
    id: number;
    product_id: number;
    product_name_snapshot: string;
    product_code_snapshot: string;
    supply_product_code_snapshot: string;
    quantity: number;
    unit: string;
    unit_price: number;
    sub_total: number;
    notes?: string;
    alert_id?: number;
    pre_order_item_id?: number;
}

export interface CreatePOResponse {
    id: number;
    po_number: string;
    supplier_id: number;
    supplier_name: string;
    po_type_id: number;
    total_amount: number;
    status: 'DRAFT' | 'PENDING' | 'APPROVED';
    creator_id: number;
    creator_name: string;
    created_at: string;
    updated_at: string;
    po_items: CreatePOItemResponse[];
}

export interface PreorderItem {
    id: number;
    pre_order_id?: number;
    product_id: number;
    product_name: string;
    product_code: string;
    supplier_part_code: string;
    quantity: number;
    unit: string;
    unit_price: number;
    net_amount?: number;
}

// -----------------------------------------
// PO MANAGEMENT & SUMMARIES (ส่วนการจัดการและสรุปข้อมูล)
// -----------------------------------------

export interface POResponse {
    id: number;
    po_number: string;
    supplier_id: number;
    supplier_name: string;
    total_amount: number;
    notes?: string;
    status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'RESUBMITTED' | 'CANCELLED' | 'DELETED';
    creator_name: string;
    created_at: string;
    updated_by_id?: number;
    updated_by_name?: string;
    updated_at?: string;
    po_items: POItemResponse[];
}

export interface GetPOsParams {
    page: number;
    limit: number;
    status?: string;
    search?: string;
    month?: string;
    year?: string;
}

export interface GetPOsResponse {
    data: POResponse[];
    total: number;
}

export interface SupplierRejectedSummary {
    supplier_id: number;
    supplier_name: string;
    amount: number;
    po_count: number;
    purchase_orders: Array<{
        id: number;
        po_number: string;
        total_amount: number;
        updated_at: string;
    }>;
}

export interface POSummaryResponse {
    pending_amount: number;
    approved_mtd_amount: number;
    monthly_approved_count: number;
    monthly_approved_last_count: number;
    approved_change_percent: number;
    rejected_mtd_amount: number;
    rejected_by_supplier?: SupplierRejectedSummary[]; 
}

export interface POMonthlyCountResponse {
    total_count: number;
    last_month_count: number;
    change_percent: number;
}

// -----------------------------------------
// UPDATE PURCHASE ORDER (ส่วนการแก้ไขใบสั่งซื้อใหม่)
// -----------------------------------------
export interface UpdatePOItemRequest {
  id?: number;          // มีค่า = item เดิม, ไม่มี = item ใหม่
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface UpdatePORequest {
  supplier_id?: number;
  po_type_id?: number;
  notes?: string;
  items?: UpdatePOItemRequest[];
}

export interface UpdatePOResponse {
  id: number;
  po_number: string;
  supplier_name: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'RESUBMITTED' | 'CANCELLED' | 'DELETED';
  total_amount: number;
  notes?: string;
  last_updated_by?: number;
  updated_by_user?: {
    id: number;
    name: string;
  };
  updated_at: string;
  po_items: CreatePOItemResponse[];
}

// -----------------------------------------
// SUPPLIER DELIVERY ANALYTICS
// -----------------------------------------
export interface POAnalyticsResponse {
    supplier_id: number;
    has_enough_data: boolean;
    estimated_days: number;
    accuracy_rate: number;
}

// -----------------------------------------
// PRE - ORDER
// -----------------------------------------
interface ProductRaw {
  product_code?: string;
  product_name?: string;
  unit?: {
    unit_name?: string;
  };
}

export interface PreOrderItemRaw {
  id: number;
  product_id: number;
  product?: ProductRaw;
  product_code?: string;
  supplier_part_code?: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  unit?: string;
}

export interface PreOrderRaw {
  id: number;
  status: string;
  pre_order_items?: PreOrderItemRaw[];
}
