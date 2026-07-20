import apiClient from "../apiClient";

import type {
  Category,
  SubCategory,
  SubSubCategory,
  Unit,
  Zone,
  Shelf,
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
  Brand,
  Model,
  Supplier
};

export const stockDataService = {
  // --- Category APIs ---
  getCategories: async (): Promise<Category[]> => {
    const res = await apiClient.get<any[]>("/wms/categories");
    return res.data || [];
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
    return res.data || [];
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
    return res.data || [];
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
    return res.data || [];
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

  // --- Zone APIs ---
  getZones: async (): Promise<Zone[]> => {
    const res = await apiClient.get<any[]>("/wms/zones");
    return res.data || [];
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
    return res.data || [];
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

  // --- Brand & Model APIs ---
  getBrands: async (): Promise<Brand[]> => {
    const res = await apiClient.get<any[]>("/wms/brands");
    return res.data || [];
  },

  // --- Supplier APIs ---
  getSuppliers: async (): Promise<Supplier[]> => {
    const res = await apiClient.get<any[]>("/wms/suppliers");
    return res.data || [];
  },
  createSupplier: async (data: Omit<Supplier, "id">): Promise<any> => {
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
