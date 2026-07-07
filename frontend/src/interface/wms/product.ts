export interface StockItem {
  ID: number;
  ProductCode: string;
  Name: string;
  PartNo: string;
  Barcode: string;
  Brand: string;
  Category: string; // ดึงมาจากฟิลด์ Category หลังบ้าน
  Grade: string;    // ดึงมาจากฟิลด์ Grade หลังบ้าน
  Stock: number;
  MinStock: number;
  Price: number;
  CostPrice: number;
  Note: string;
  Unit?: string;
  Shelf?: string;
  Supplier?: string;
}