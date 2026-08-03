import apiClient from "../apiClient";
import type { StockItem } from "../../../interface/wms/product";

const resolveAssetUrl = (url: string): string => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.startsWith("/") ? url : `/${url}`;
  try {
    const apiOrigin = new URL(apiClient.defaults.baseURL || "").origin;
    return `${apiOrigin}${normalized}`;
  } catch {
    return normalized;
  }
};

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
    ThumbnailUrl: resolveAssetUrl(item.thumbnail_url || ""),
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

export const uploadProductImage = async (productId: number, file: File): Promise<any> => {
  const formData = new FormData();
  formData.append("image", file);

  // ใช้ fetch แทน Axios เพื่อให้บราวเซอร์ตั้งค่า multipart/form-data boundary ให้อัตโนมัติ
  // ใช้ baseURL จาก apiClient เพื่อรองรับทั้ง local (ผ่าน Vite proxy) และบน cloud (port 8080 ตรงๆ)
  const token = localStorage.getItem("token");
  const baseURL = apiClient.defaults.baseURL || "http://localhost:8080/api";
  const url = `${baseURL}/wms/products/${productId}/images`;

  const response = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }
  return response.json();
};

export const updateProduct = async (id: number, data: any): Promise<any> => {
  const response = await apiClient.put(`/wms/products/${id}`, data);
  return response.data;
};
