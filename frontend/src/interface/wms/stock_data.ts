export interface Category {
  id: number;
  category_name: string;
  category_short_name: string;
  description: string;
  created_at?: string;
}

export interface SubCategory {
  id: number;
  sub_category_name: string;
  sub_category_short_name: string;
  description: string;
  category_id: number;
  category?: Category;
  created_at?: string;
}

export interface SubSubCategory {
  id: number;
  sub_sub_category_name: string;
  sub_sub_category_short_name: string;
  description: string;
  sub_category_id: number;
  sub_category_name?: string;
  sub_category?: SubCategory;
  created_at?: string;
}

export interface Unit {
  id: number;
  unit_name: string;
}

export interface Grade {
  id: number;
  grade_name: string;
}

export interface Zone {
  id: number;
  zone_name: string;
  shelves?: Shelf[];
  created_at?: string;
}

export interface ShelfLevel {
  id: number;
  level_name: string;
  shelf_id: number;
  created_at?: string;
}

export interface Shelf {
  id: number;
  shelf_name: string;
  zone_id: number;
  zone?: Zone;
  shelf_levels?: ShelfLevel[];
  created_at?: string;
}

export interface Brand {
  id: number;
  brand_name: string;
  models?: Model[];
  // Brand/Model ส่งกลับมาจาก backend เป็น entity ดิบ (ไม่ผ่าน DTO) เลยได้ field ชื่อ CreatedAt (ตัวใหญ่) มาแทน created_at
  CreatedAt?: string;
}

export interface Model {
  id: number;
  model_name: string;
  brand_id: number;
  CreatedAt?: string;
}

export interface Supplier {
  id: number;
  supplier_name: string;
  short_supplier_name: string;
  supplier_address: string;
  contact_line_sale: string;
  phone_number_sale: string;
  email_sale: string;
  contact_line_sale_2?: string;
  phone_number_sale_2?: string;
  email_sale_2?: string;
  bank_account_number: string;
  created_at?: string;
}
