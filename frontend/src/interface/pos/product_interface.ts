// แมตช์ตาม POSProductSupplierInfo — รหัส/บาร์โค้ดของสินค้าตัวนี้ตามที่ Supplier แต่ละเจ้าใช้
export interface POSProductSupplierInfo {
  supplier_id: number;
  supplier_name: string;
  barcode: string;
  variant_code: string;
  company_product_code: string;
  // quantity: คงเหลือของสินค้าตัวนี้เฉพาะที่รับมาจากบริษัทนี้เจ้าเดียว (ไม่ใช่ยอดรวมทั้งร้าน)
  quantity: number;
}

// แมตช์ตาม POSProductResponse
export interface POSProductResponse {
  id: number;
  product_code: string;
  part_number: string;
  product_name: string;
  barcode: string;
  quantity: number;
  sale_price: number;
  note: string;
  grade_name?: string;
  brand_name?: string;
  model_name?: string;
  max_discount_rate?: number; // เพดานส่วนลดสูงสุดของสินค้าตัวนี้ (หน้าบ้านต้องพ่วงฟิลด์นี้มาด้วย)
  // suppliers: ไว้เทียบว่าคำค้นหา/บาร์โค้ดที่แสกนตรงกับเจ้าไหนเจาะจงไหม เพื่อผูกการขายชิ้นนี้กับ Supplier นั้น
  suppliers?: POSProductSupplierInfo[];
}