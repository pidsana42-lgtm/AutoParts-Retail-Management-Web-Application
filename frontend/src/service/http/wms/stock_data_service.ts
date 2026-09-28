import apiClient from "../apiClient";

import type {
  Category,
  SubCategory,
  SubSubCategory,
  Unit,
  Grade,
  Zone,
  Shelf,
  ShelfLevel,
  Brand,
  Model,
  Supplier
} from "../../../interface/wms/stock_data";

export type {
  Category,
  SubCategory,
  SubSubCategory,
  Unit,
  Zone,
  Shelf,
  ShelfLevel,
  Brand,
  Model,
  Supplier
};

export const stockDataService = {
  // Helper to normalize GORM's ID field to frontend's expected id field
  _mapIds: (items: any[]) => {
    if (!Array.isArray(items)) return [];
    return items.map((item) => {
      const normalized = { ...item };
      if (normalized.id === undefined && normalized.ID !== undefined) {
        normalized.id = normalized.ID;
      }
      return normalized;
    });
  },

  // --- Category APIs ---
  getCategories: async (): Promise<Category[]> => {
    const res = await apiClient.get<any[]>("/wms/categories");
    return stockDataService._mapIds(res.data);
  },
  createCategory: async (data: Omit<Category, "id">): Promise<any> => {
    const res = await apiClient.post("/wms/categories", data);
    return res.data;
  },
  updateCategory: async (id: number, data: Partial<Category>): Promise<any> => {
    const res = await apiClient.put(`/wms/categories/${id}`, data);
    return res.data;
  },
  deleteCategory: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/categories/${id}`);
    return res.data;
  },

  // --- SubCategory APIs ---
  getSubCategories: async (categoryId?: number): Promise<SubCategory[]> => {
    const url = categoryId ? `/wms/sub-categories?category_id=${categoryId}` : "/wms/sub-categories";
    const res = await apiClient.get<any[]>(url);
    return stockDataService._mapIds(res.data);
  },
  createSubCategory: async (data: Omit<SubCategory, "id" | "category">): Promise<any> => {
    const res = await apiClient.post("/wms/sub-categories", data);
    return res.data;
  },
  updateSubCategory: async (id: number, data: Partial<SubCategory>): Promise<any> => {
    const res = await apiClient.put(`/wms/sub-categories/${id}`, data);
    return res.data;
  },
  deleteSubCategory: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/sub-categories/${id}`);
    return res.data;
  },

  // --- SubSubCategory APIs ---
  getSubSubCategories: async (subCategoryId?: number): Promise<SubSubCategory[]> => {
    const url = subCategoryId ? `/wms/sub-sub-categories?sub_category_id=${subCategoryId}` : "/wms/sub-sub-categories";
    const res = await apiClient.get<any[]>(url);
    return stockDataService._mapIds(res.data);
  },
  createSubSubCategory: async (data: Omit<SubSubCategory, "id" | "sub_category" | "sub_category_name">): Promise<any> => {
    const res = await apiClient.post("/wms/sub-sub-categories", data);
    return res.data;
  },
  updateSubSubCategory: async (id: number, data: Partial<SubSubCategory>): Promise<any> => {
    const res = await apiClient.put(`/wms/sub-sub-categories/${id}`, data);
    return res.data;
  },
  deleteSubSubCategory: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/sub-sub-categories/${id}`);
    return res.data;
  },

  // --- Unit APIs ---
  getUnits: async (): Promise<Unit[]> => {
    const res = await apiClient.get<any[]>("/wms/units");
    return stockDataService._mapIds(res.data);
  },
  createUnit: async (data: Omit<Unit, "id">): Promise<any> => {
    const res = await apiClient.post("/wms/units", data);
    return res.data;
  },
  updateUnit: async (id: number, data: Partial<Unit>): Promise<any> => {
    const res = await apiClient.put(`/wms/units/${id}`, data);
    return res.data;
  },
  deleteUnit: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/units/${id}`);
    return res.data;
  },

  // --- Grade APIs ---
  getGrades: async (): Promise<Grade[]> => {
    const res = await apiClient.get<any[]>("/wms/grades");
    return stockDataService._mapIds(res.data);
  },
  createGrade: async (data: Omit<Grade, "id">): Promise<any> => {
    const res = await apiClient.post("/wms/grades", data);
    return res.data;
  },
  updateGrade: async (id: number, data: Partial<Grade>): Promise<any> => {
    const res = await apiClient.put(`/wms/grades/${id}`, data);
    return res.data;
  },
  deleteGrade: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/grades/${id}`);
    return res.data;
  },

  // --- Zone APIs ---
  getZones: async (): Promise<Zone[]> => {
    const res = await apiClient.get<any[]>("/wms/zones");
    return stockDataService._mapIds(res.data);
  },
  createZone: async (data: Omit<Zone, "id" | "shelves">): Promise<any> => {
    const res = await apiClient.post("/wms/zones", data);
    return res.data;
  },
  updateZone: async (id: number, data: Partial<Zone>): Promise<any> => {
    const res = await apiClient.put(`/wms/zones/${id}`, data);
    return res.data;
  },
  deleteZone: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/zones/${id}`);
    return res.data;
  },

  // --- Shelf APIs ---
  getShelves: async (): Promise<Shelf[]> => {
    const res = await apiClient.get<any[]>("/wms/shelves");
    return stockDataService._mapIds(res.data);
  },
  createShelf: async (data: Omit<Shelf, "id" | "zone">): Promise<any> => {
    const res = await apiClient.post("/wms/shelves", data);
    return res.data;
  },
  updateShelf: async (id: number, data: Partial<Shelf>): Promise<any> => {
    const res = await apiClient.put(`/wms/shelves/${id}`, data);
    return res.data;
  },
  deleteShelf: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/shelves/${id}`);
    return res.data;
  },

  // --- ShelfLevel APIs ---
  createShelfLevel: async (data: Omit<ShelfLevel, "id">): Promise<any> => {
    const res = await apiClient.post("/wms/shelf-levels", data);
    return res.data;
  },
  updateShelfLevel: async (id: number, data: Partial<ShelfLevel>): Promise<any> => {
    const res = await apiClient.put(`/wms/shelf-levels/${id}`, data);
    return res.data;
  },
  deleteShelfLevel: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/shelf-levels/${id}`);
    return res.data;
  },

  // --- Brand & Model APIs ---
  getBrands: async (): Promise<Brand[]> => {
    const res = await apiClient.get<any[]>("/wms/brands");
    const brands = stockDataService._mapIds(res.data);
    // _mapIds ปกติ normalize แค่ระดับบนสุด (ID -> id) ของแต่ละ item ในลิสต์ — แต่ละแบรนด์ยังมี models[] ซ้อนอยู่
    // ข้างในที่ก็เป็น entity ดิบเหมือนกัน (มี ID ไม่มี id) ต้อง normalize ซ้ำอีกชั้นให้ด้วย ไม่งั้น model.id
    // จะเป็น undefined (ทำให้ลบ/แก้ไขรุ่นรถจากตารางไม่ได้ เพราะ URL กลายเป็น /wms/models/undefined)
    return brands.map((b: any) => ({
      ...b,
      models: stockDataService._mapIds(b.models || []),
    }));
  },
  createBrand: async (data: { brand_name: string }): Promise<any> => {
    const res = await apiClient.post("/wms/brands", data);
    return res.data;
  },
  updateBrand: async (id: number, data: { brand_name: string }): Promise<any> => {
    const res = await apiClient.put(`/wms/brands/${id}`, data);
    return res.data;
  },
  deleteBrand: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/brands/${id}`);
    return res.data;
  },
  createModel: async (data: { model_name: string; brand_id: number }): Promise<any> => {
    const res = await apiClient.post("/wms/models", data);
    return res.data;
  },
  updateModel: async (id: number, data: { model_name: string; brand_id: number }): Promise<any> => {
    const res = await apiClient.put(`/wms/models/${id}`, data);
    return res.data;
  },
  deleteModel: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/models/${id}`);
    return res.data;
  },

  // --- Supplier APIs ---
  getSuppliers: async (): Promise<Supplier[]> => {
    const res = await apiClient.get<any[]>("/wms/suppliers");
    return stockDataService._mapIds(res.data);
  },
  // คืนข้อมูล Supplier ที่เพิ่งสร้าง (มี id) กลับมาด้วย เผื่อผู้เรียกอยากเลือกใช้ Supplier นี้ต่อทันที
  createSupplier: async (data: Omit<Supplier, "id">): Promise<Supplier> => {
    const res = await apiClient.post("/wms/suppliers", data);
    return res.data;
  },
  updateSupplier: async (id: number, data: Partial<Supplier>): Promise<any> => {
    const res = await apiClient.put(`/wms/suppliers/${id}`, data);
    return res.data;
  },
  deleteSupplier: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/suppliers/${id}`);
    return res.data;
  },
};
