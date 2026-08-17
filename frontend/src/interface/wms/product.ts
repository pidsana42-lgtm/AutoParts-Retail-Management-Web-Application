export interface StockItem {
  ID: number;
  ProductCode: string;
  Name: string;
  PartNo: string;
  Barcode: string;
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
  Supplier?: string;
}
