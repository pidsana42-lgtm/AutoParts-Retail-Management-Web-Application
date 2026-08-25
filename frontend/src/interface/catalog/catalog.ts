export interface CatalogItem {
  id?: number;
  catalog_id?: number;
  part_number: string;
  part_name: string;
  brand?: string;
  supplier_name?: string;
  st_no?: string; // รหัสสินค้าฝั่งคู่ค้า (ยังไม่มีคอลัมน์นี้จริงใน backend ตอนนี้ เลยจะว่างเสมอ ใช้ fallback เป็น part_number แทน)
  compatible_cars?: string;
  standard_price: number;
  unit: string;
  image?: string;
  image_thumbnail?: string;
  remark?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Catalog {
  id: number;
  catalog_code: string;
  catalog_name: string;
  brand: string;
  category?: string;
  supplier_id: number;
  supplier_name?: string;
  description?: string;
  cover_image?: string;
  catalog_file?: string;
  is_active: boolean;
  item_count?: number;
  catalog_items?: CatalogItem[];
  created_at?: string;
  updated_at?: string;
}
