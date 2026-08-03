import apiClient from "../apiClient";
import type { StockItem } from "../../../interface/wms/product";

export const getProductsList = async (): Promise<StockItem[]> => {
  // เติม /wms นำหน้า /products ให้ตรงกับระบบหลังบ้าน
  const response = await apiClient.get<any[]>("/wms/products"); 
  return (response.data || []).map((item) => ({
    ID: item.id,
    ProductCode: item.product_code || "",
    Name: item.product_name || "",
    PartNo: item.part_number || "",
    Barcode: item.barcode || "",
    Models: item.models || [],
    Category: item.category_name || "",
    SubCategory: item.sub_category_name || "",
    SubSubCategory: item.sub_sub_category_name || "",
    Grade: item.grade_name || "A",
    Stock: item.quantity || 0,
    MinStock: item.limit_quantity || 0,
    Price: item.sale_price || 0,
    CostPrice: item.cost_price || 0,
    Note: item.note || "",
    Unit: item.unit_name || "",
    Shelf: item.shelf_name || "",
    ShelfLevel: item.shelf_level_name || "",
    Supplier: item.supplier_name || "",
  }));
};

export interface WmsOption {
  id: number;
  name: string;
}

export const getCategoriesList = async (): Promise<WmsOption[]> => {
  const response = await apiClient.get<any[]>("/wms/categories");
  return (response.data || []).map((item) => ({
    id: item.id,
    name: item.category_name || "",
  }));
};

export const getSuppliersList = async (): Promise<WmsOption[]> => {
  const response = await apiClient.get<any[]>("/wms/suppliers");
  return (response.data || []).map((item) => ({
    id: item.id,
    name: item.supplier_name || "",
  }));
};

export const getBrandsList = async (): Promise<WmsOption[]> => {
  const response = await apiClient.get<any[]>("/wms/brands");
  return (response.data || []).map((item) => ({
    id: item.ID || item.id,
    name: item.brand_name || "",
  }));
};

export const getGradesList = async (): Promise<WmsOption[]> => {
  const response = await apiClient.get<any[]>("/wms/grades");
  return (response.data || []).map((item) => ({
    id: item.ID || item.id,
    name: item.grade_name || "",
  }));
};

export const getUnitsList = async (): Promise<WmsOption[]> => {
  const response = await apiClient.get<any[]>("/wms/units");
  return (response.data || []).map((item) => ({
    id: item.ID || item.id,
    name: item.unit_name || "",
  }));
};

export const getShelvesList = async (): Promise<WmsOption[]> => {
  const response = await apiClient.get<any[]>("/wms/shelves");
  return (response.data || []).map((item) => ({
    id: item.ID || item.id,
    name: item.shelf_name || "",
  }));
};

export const createProduct = async (data: any): Promise<any> => {
  const response = await apiClient.post("/wms/products", data);
  return response.data;
};

export const updateProduct = async (id: number, data: any): Promise<any> => {
  const response = await apiClient.put(`/wms/products/${id}`, data);
  return response.data;
};