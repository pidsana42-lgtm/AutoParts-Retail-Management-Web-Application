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
