import apiClient from "../apiClient";
import axios from "axios";
import type {
  Supplier,
  Product,
  SavedBill,
  BillItemDTO
} from "../../../interface/import";

export interface ConfirmBillPayload {
  bill: {
    bill_no: string;
    total_amount: number;
    due_date: string;
    credit_term?: string;
    transport_by: string;
    supplier_id: number;
    supplier_name?: string;
    subtotal: number;
    discount_total: number;
    receive_date: string;
    vat_amount: number;
    grand_total: number;
    payment_status: string;
    po_id?: number;
    bill_image_id?: number;
    is_verified?: boolean;
    verified_by?: number;
    ocr_text?: string;
    evidence_file_url?: string;
    evidence_uploaded_at?: string;
  };
  items: BillItemDTO[];
  draft_json?: string;
}

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

// 4. ส่งรูปบิลไปสแกนด้วย AI OCR (รองรับทั้ง Go Backend Proxy และ Vite Dev Proxy)
export async function scanBill(file: File): Promise<any> {
  const uploadData = new FormData();
  uploadData.append("file", file);

  // 1. ลองส่งผ่าน Go Backend Proxy (/api/ocr/extract-invoice/upload)
  try {
    const response = await apiClient.post("/ocr/extract-invoice/upload", uploadData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 300000,
    });
    if (response.data && !response.data.error) {
      return response.data;
    }
  } catch (err) {
    console.warn("Go backend proxy OCR failed, trying local Vite/FastAPI endpoint...", err);
  }

  // 2. สำรอง: ยิงผ่าน Vite Dev Proxy (/ocr/api/extract-invoice/upload)
  try {
    const response = await axios.post("/ocr/api/extract-invoice/upload", uploadData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 300000,
    });
    if (response.data && response.data.error) {
      throw new Error(response.data.error);
    }
    return response.data;
  } catch (error: any) {
    console.error("Error during OCR scan:", error);
    const errMsg = error.response?.data?.detail || error.response?.data?.error || error.message || "เกิดข้อผิดพลาดในการเชื่อมต่อสแกนบิล";
    throw new Error(errMsg);
  }
}

// 5. บันทึกยืนยันบิลใหม่
export async function confirmBillImport(jobId: number, payload: ConfirmBillPayload): Promise<any> {
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
export async function updateBill(billId: number, payload: ConfirmBillPayload): Promise<any> {
  try {
    const response = await apiClient.put(`/import-data/bills/${billId}`, payload);
    return response.data;
  } catch (error: any) {
    console.error("Error updating bill:", error);
    const errMsg = error.response?.data?.error || error.message || String(error);
    throw new Error(errMsg);
  }
}

// 7. อนุมัติบิล (เจ้าของ)
export async function approveBill(billId: number, bill: SavedBill): Promise<any> {
  const payload: ConfirmBillPayload = {
    bill: {
      bill_no: bill.bill_no,
      total_amount: bill.total_amount,
      due_date: bill.due_date,
      credit_term: bill.credit_term,
      transport_by: bill.transport_by,
      supplier_id: bill.supplier_id,
      subtotal: bill.subtotal,
      discount_total: bill.discount_total,
      receive_date: bill.receive_date,
      vat_amount: bill.vat_amount,
      grand_total: bill.grand_total,
      payment_status: 'approved',
      is_verified: true,
      bill_image_id: bill.bill_image?.id,
    },
    items: (bill.bill_items || []).map(item => ({
      item_sequence: item.item_sequence,
      company_product_code: item.company_product_code,
      company_product_name: item.company_product_name,
      order_quantity: item.order_quantity,
      unit: item.unit,
      conversion_factor: item.conversion_factor,
      price_per_unit: item.price_per_unit,
      discount_amount: item.discount_amount,
      net_amount: item.net_amount,
      is_freebie: item.is_freebie,
      remark: item.remark,
      product_id: item.product_id,
    })),
  };
  return updateBill(billId, payload);
}

// 8. ลบบิลย้อนหลัง
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

export const MOCK_POS = [
  {
    id: 101,
    order_number: 'PO-202607-001',
    supplier_id: 1,
    supplier_name: 'บริษัท ไทยยรรยง อะไหล่ยนต์ จำกัด',
    total_amount: 15400.00,
    status: 'APPROVED',
    created_at: new Date().toISOString(),
    items: [
      { id: 1, company_product_code: 'BP-TOY-01', company_product_name: 'ผ้าเบรคหน้า TOYOTA VIOS 2012', order_quantity: 10, unit: 'ชุด', price_per_unit: 850.00, net_amount: 8500.00 },
      { id: 2, company_product_code: 'OF-HON-02', company_product_name: 'กรองน้ำมันเครื่อง HONDA CIVIC FC', order_quantity: 20, unit: 'ชิ้น', price_per_unit: 145.00, net_amount: 2900.00 },
      { id: 3, company_product_code: 'SP-NGK-03', company_product_name: 'หัวเทียน NGK IRIDIUM BKR6EIX', order_quantity: 20, unit: 'หัว', price_per_unit: 200.00, net_amount: 4000.00 }
    ]
  },
  {
    id: 102,
    order_number: 'PO-202607-002',
    supplier_id: 2,
    supplier_name: 'บริษัท ออโต้พาร์ท อินเตอร์เนชั่นแนล จำกัด',
    total_amount: 28900.00,
    status: 'APPROVED',
    created_at: new Date().toISOString(),
    items: [
      { id: 4, company_product_code: 'SA-ISU-05', company_product_name: 'โช๊คอัพหน้า ISUZU D-MAX 4WD', order_quantity: 4, unit: 'คู่', price_per_unit: 3200.00, net_amount: 12800.00 },
      { id: 5, company_product_code: 'CL-ISU-06', company_product_name: 'ชุดจานคลัตช์ ISUZU D-MAX 2.5', order_quantity: 3, unit: 'ชุด', price_per_unit: 5366.67, net_amount: 16100.00 }
    ]
  }
];

// 8. ดึงรายการใบสั่งซื้อ (Purchase Orders) สำหรับนำเข้า
export async function getPurchaseOrders(): Promise<any[]> {
  const endpoints = ["/po/get-all-po", "/import-data/purchase-orders", "/purchase-orders"];
  for (const endpoint of endpoints) {
    try {
      const response = await apiClient.get(endpoint);
      const data = response.data?.data || response.data || [];
      if (Array.isArray(data)) return data;
    } catch {
      // try next endpoint
    }
  }
  return [];
}

// 9. ดึงรายละเอียดใบสั่งซื้อรายรายการ
export async function getPurchaseOrderById(poId: number): Promise<any> {
  const endpoints = [`/po/${poId}`, `/import-data/purchase-orders/${poId}`, `/purchase-orders/${poId}`];
  for (const endpoint of endpoints) {
    try {
      const response = await apiClient.get(endpoint);
      const resData = response.data?.data || response.data;
      if (resData) return resData;
    } catch {
      // try next endpoint
    }
  }
  return null;
}

// 10. อัปเดตราคาทุนของสินค้าโดยตรง
export async function updateProductCostPrice(productId: number, costPrice: number): Promise<any> {
  try {
    const response = await apiClient.put(`/import-data/products/${productId}/cost-price`, {
      cost_price: costPrice
    });
    return response.data;
  } catch (error: any) {
    console.error("Error updating product cost price:", error);
    const errMsg = error.response?.data?.error || "ล้มเหลวในการอัปเดตราคาสินค้า";
    throw new Error(errMsg);
  }
}

// 11. อัปเดตรายละเอียดสินค้าจากหน้านำเข้าบิล
export async function updateImportProduct(productId: number, payload: any): Promise<any> {
  try {
    const response = await apiClient.put(`/import-data/products/${productId}`, payload);
    return response.data;
  } catch (error: any) {
    console.error("Error updating import product:", error);
    const errMsg = error.response?.data?.error || error.message || String(error);
    throw new Error(errMsg);
  }
}

// 12. Helper สำหรับแปลง path รูปภาพให้โหลดผ่าน static file server / proxy ได้ถูกต้อง
export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  // นำหน้าด้วย '/' เสมอเพื่อให้ browser ร้องขอจาก root (/uploads/...) ซึ่งจะผ่าน proxy ของ Vite
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

