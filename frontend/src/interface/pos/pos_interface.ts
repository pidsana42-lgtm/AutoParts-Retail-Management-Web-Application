// แมตช์ตาม SaleOrderItemRequest ของฝั่ง Go (สินค้าแต่ละแถวในบิล)
export interface SaleOrderItemRequest {
  product_code: string;
  product_id: number;
  product_name: string;
  qty: number;
  unit_price: number;
  discount_type: "none" | "percentage" | "amount";
  discount_value: number;
  part_number?: string;
  grade_name?: string;
  brand_name?: string;
  model_name?: string;
  note?: string;
}

// แมตช์ตาม CreateSaleOrderRequest ของฝั่ง Go (ก้อนวัตถุ Payload ภาพรวมทั้งบิล)
export interface CreateSaleOrderRequest {
  customer_id: number;
  payment_method_id: number; // 1=เงินสด, 2=QR, 3=เงินเชื่อ
  bill_discount_type: "none" | "percentage" | "amount";
  bill_discount_value: number;
  note: string;
  items: SaleOrderItemRequest[];
}
