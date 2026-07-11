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
    product_name_code_snapshot: string;
    quantity: number;
    unit: string;
    unit_price: number;
    sub_total: number;
}

// ข้อมูลที่เพิ่ม type เพื่อใช้จัดการ State ภายในหน้าเว็บ
export type LocalPOItem = POItemResponse & { 
    order_type: 'สั่งซื้อ' | 'พรีออเดอร์' 
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
    po_type_id: number;
    status: 'DRAFT' | 'PENDING';
    po_items: CreatePOItemRequest[];
}

export interface CreatePOItemResponse {
    id: number;
    product_id: number;
    product_name_snapshot: string;
    product_name_code_snapshot: string;
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
    order_number: string;
    supplier_id: number;
    supplier_name: string;
    po_type_id: number;
    total_amount: number;
    status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
    creator_id: number;
    creator_name: string;
    created_at: Date;
    updated_at: Date;
    po_items: CreatePOItemResponse[];
}

export interface PreorderItem {
    id: number;
    product_id: number;
    product_name: string;
    product_code: string;
    quantity: number;
    unit: string;
    unit_price: number;
    net_amount?: number;
}

// -----------------------------------------
// // PO MANAGEMENT & SUMMARIES (ส่วนการจัดการและสรุปข้อมูล)
// -----------------------------------------

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

export interface GetPOsParams {
    page: number;
    limit: number;
    status?: string;
    search?: string;
    date?: string;
}

export interface GetPOsResponse {
    data: POResponse[];
    total: number;
}

export interface SupplierRejectedSummary {
    supplier_name: string;
    amount: number;
}

export interface POSummaryResponse {
    pending_amount: number;
    approved_mtd_amount: number;
    rejected_mtd_amount: number;
    total_count: number;
    rejected_by_supplier?: SupplierRejectedSummary[]; 
}