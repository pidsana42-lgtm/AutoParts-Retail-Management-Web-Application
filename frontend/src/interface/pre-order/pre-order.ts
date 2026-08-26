export interface PreOrderItem {
  id?: number;
  product_id: number;
  product_name?: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  net_amount?: number;
}

export interface PreOrder {
  id?: number;
  pre_order_type: string;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  deposit_amount: number;
  status: string;
  po_number?: string;
  po_status?: string;
  po_id?: number;
  order_date?: string;
  supplier_id: number;
  supplier_name?: string;
  pre_order_items: PreOrderItem[];
  created_at?: string;
  updated_at?: string;
}
