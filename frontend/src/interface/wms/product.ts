export interface StockItem {
  ID: number;
  ProductCode: string;
  Name: string;
  PartNo: string;
  Models?: { id: number; model_name: string; brand_name: string }[];
  Category: string; // ดึงมาจากฟิลด์ Category หลังบ้าน
  SubCategory?: string;
  SubSubCategory?: string;
  Grade: string;    // ดึงมาจากฟิลด์ Grade หลังบ้าน
  Stock: number;
  MinStock: number;
  Price: number;
  CostPrice: number;
  MaxDiscountRate: number; // เพดานส่วนลดสูงสุดที่ POS กดลดให้สินค้าชิ้นนี้ได้ (%)
  ThumbnailUrl?: string;
  Note: string;
  Unit?: string;
  Shelf?: string;
  ShelfLevel?: string;
  Zone?: string;
  // Supplier: รวมชื่อ Supplier ทุกเจ้าที่สินค้านี้รับมาจาก คั่นด้วย ", " (ใช้กับตัวกรอง/แสดงผลแบบสั้นในตาราง)
  Supplier?: string;
  // Suppliers: รายละเอียดแยกเจ้า พร้อมจำนวนที่รับจากแต่ละเจ้า (มาจากตาราง Inventory)
  // CompanyProductCode: รหัสสินค้าตามที่ Supplier เจ้านั้นใช้เรียกสินค้าชิ้นนี้ (ผูกกับ Supplier แต่ละเจ้า ไม่ใช่กับสินค้าโดยตรง
  // เพราะสินค้า 1 ชื่อในร้านมาได้จากหลายบริษัท แต่ละเจ้าใช้รหัสของตัวเองไม่เหมือนกัน)
  // VariantCode: รหัสล็อตต่อบริษัทที่ระบบออกให้อัตโนมัติ (เช่น BP-123-SU3) ใช้พิมพ์ QR/บาร์โค้ดแยกบริษัท
  Suppliers?: { SupplierID: number; SupplierName: string; Quantity: number; CompanyProductCode?: string; VariantCode?: string; Barcode?: string; QRCode?: string }[];
  // UpdatedAt: วันที่ข้อมูลสินค้าถูกแก้ไขล่าสุด — ใช้กรองตามช่วงเวลาที่หน้า "จัดการคลังสินค้า"
  UpdatedAt?: string;
  // DeletedAt: มีค่าเฉพาะตอนดึงรายการ "สินค้าที่ถูกลบ" (ถังขยะ) เท่านั้น
  DeletedAt?: string;
}
