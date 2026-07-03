import apiClient from "../apiClient";
import axios from "axios";
import type {
  Supplier,
  Product,
  SavedBill
} from "../../../interface/import";

// 1. ดึงประวัติบิลทั้งหมด
export async function getBills(): Promise<SavedBill[]> {
  try {
    const response = await apiClient.get<{ data: SavedBill[] }>("/import-data/bills");
    if (response.data) {
      return Array.isArray(response.data) ? response.data : (response.data.data || []);
    }
    return [];
  } catch (error: any) {
    console.error("Error fetching bills:", error);
    const errMsg = error.response?.data?.error || "ล้มเหลวในการดึงข้อมูลบิล";
    throw new Error(errMsg);
  }
}


// 2. ดึงรายชื่อซัพพลายเออร์
export async function getSuppliers(): Promise<Supplier[]> {
  try {
    const response = await apiClient.get<Supplier[] | { data: Supplier[] }>("/wms/suppliers");
    if (response.data) {
      return Array.isArray(response.data) ? response.data : ((response.data as any).data || []);
    }
    return [];
  } catch (error: any) {
    console.error("Error fetching suppliers:", error);
    const errMsg = error.response?.data?.error || "ล้มเหลวในการดึงข้อมูลผู้จัดจำหน่าย";
    throw new Error(errMsg);
  }
}

// 3. ดึงรายชื่อสินค้าทั้งหมดในระบบ
export async function getProducts(): Promise<Product[]> {
  try {
    const response = await apiClient.get<Product[] | { data: Product[] }>("/wms/products");
    if (response.data) {
      return Array.isArray(response.data) ? response.data : ((response.data as any).data || []);
    }
    return [];
  } catch (error: any) {
    console.error("Error fetching products:", error);
    const errMsg = error.response?.data?.error || "ล้มเหลวในการดึงข้อมูลสินค้า";
    throw new Error(errMsg);
  }
}

// 4. ส่งรูปบิลไปสแกนด้วย AI OCR (FastAPI Server)
export async function scanBill(file: File): Promise<any> {
  const uploadData = new FormData();
  uploadData.append("file", file);

  try {
    const response = await axios.post("http://localhost:8000/api/extract-invoice/upload", uploadData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    
    if (response.data && response.data.error) {
      throw new Error(response.data.error);
    }
    return response.data;
  } catch (error: any) {
    console.error("Error during OCR scan:", error);
    const errMsg = error.response?.data?.detail || error.message || "เกิดข้อผิดพลาดในการเชื่อมต่อสแกนบิล";
    throw new Error(errMsg);
  }
}

// 5. บันทึกยืนยันบิลใหม่
export async function confirmBillImport(jobId: number, payload: any): Promise<any> {
  try {
    const response = await apiClient.post(`/import-data/bill-import-jobs/${jobId}/confirm`, payload);
    return response.data;
  } catch (error: any) {
    console.error("Error confirming bill:", error);
    const errMsg = error.response?.data?.error || error.message || String(error);
    throw new Error(errMsg);
  }
}

// 6. บันทึกแก้ไขบิลเดิม
export async function updateBill(billId: number, payload: any): Promise<any> {
  try {
    const response = await apiClient.put(`/import-data/bills/${billId}`, payload);
    return response.data;
  } catch (error: any) {
    console.error("Error updating bill:", error);
    const errMsg = error.response?.data?.error || error.message || String(error);
    throw new Error(errMsg);
  }
}

// 7. ลบบิลย้อนหลัง
export async function deleteBill(billId: number): Promise<any> {
  try {
    const response = await apiClient.delete(`/import-data/bills/${billId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error deleting bill:", error);
    const errMsg = error.response?.data?.error || error.message || String(error);
    throw new Error(errMsg);
  }
}
