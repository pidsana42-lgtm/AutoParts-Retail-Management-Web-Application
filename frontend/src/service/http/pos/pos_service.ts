import apiClient from "../apiClient";
import type { CreateSaleOrderRequest, SaleOrderItemRequest, UpdateSaleOrderRequest } from "../../../interface/pos/pos_interface";
import type { POSProductResponse } from "../../../interface/pos/product_interface";
import type { StoreConfigInterface } from "../../../interface/pos/store_config_interface";
import type { CustomerDiscountResponse } from "../../../interface/pos/customer_interface";
import type { CancelledPaymentItem, CancelPaymentReceiptRequest, ConfirmPaymentRequest, PaymentHistoryItem, RequestCancelPaymentReceiptRequest, ProcessCancelPaymentReceiptRequest } from "../../../interface/pos/payment_interface";
import type { SalesHistoryFilterRequest, SalesHistoryPaginationResponse, SalesHistoryItemResponse, GetSaleHistoryByIDResponse, RevertCancellationRequestResponse } from "../../../interface/pos/sales_history_interface";
import type { CustomerUnpaidBillsResponse, SettleBillsRequest, SettleBillsResponse, GenerateSettleQRRequest, GenerateSettleQRResponse } from "../../../interface/pos/settle_bills_interface";
import type { FinancialPolicyAuditLog } from "../../../interface/storeconfig/financial_policy_interface";

// ==================== API Services ====================
export const posApiService = {
  /** ดึงค่าตั้งค่าคอนฟิกร้านค้า */
  getStoreConfig: (): Promise<StoreConfigInterface> => 
    apiClient.get<StoreConfigInterface>("/pos/store-config").then((res) => res.data),

  /** ดึงประวัติการแก้ไขการตั้งค่าร้านค้า (Audit Logs) */
  getStoreConfigAuditLogs: (): Promise<FinancialPolicyAuditLog[]> =>
    apiClient.get<FinancialPolicyAuditLog[]>("/pos/store-config/audit-logs").then((res) => res.data || []),

  /** สร้างค่าตั้งค่าคอนฟิกร้านค้าครั้งแรก (POST) */
  createStoreConfig: (payload: Partial<StoreConfigInterface>): Promise<any> =>
    apiClient.post("/pos/store-config", payload).then((res) => res.data),

  /** อัปเดตค่าตั้งค่าคอนฟิกร้านค้า (PUT) */
  updateStoreConfig: (payload: Partial<StoreConfigInterface>): Promise<any> =>
    apiClient.put("/pos/store-config", payload).then((res) => res.data),

  /** ค้นหาข้อมูลสิทธิ์ส่วนลดและโปรไฟล์ลูกค้า */
  searchCustomerDiscount: (query: string): Promise<CustomerDiscountResponse[]> => 
    apiClient
      .get<CustomerDiscountResponse[]>(`/pos/customer-discount?search=${encodeURIComponent(query)}`)
      .then((res) => res.data || [])
      .catch(() => []),

  /** ค้นหาข้อมูลอะไหล่ยนต์ในสต๊อกระบบ */
  searchProducts: (query: string): Promise<POSProductResponse[]> => 
    apiClient.get<POSProductResponse[]>(`/pos/products?q=${encodeURIComponent(query)}`).then((res) => res.data),

  /** บันทึกคำสั่งซื้อออเดอร์ขาย POS */
  createPOSOrder: (payload: CreateSaleOrderRequest): Promise<any> => 
    apiClient.post("/pos/orders", payload).then((res) => res.data),

  /** อัปเดตคำสั่งซื้อออเดอร์ขาย POS (ตาม orderNumber) */
  updatePOSOrder: (orderNumber: string, payload: UpdateSaleOrderRequest): Promise<any> =>
    apiClient.put(`/pos/orders/${orderNumber}`, payload).then((res) => res.data),

  getCustomerTypes: (): Promise<{ id: number; type_name: string }[]> => 
    apiClient.get<{ id: number; type_name: string }[]>("/pos/customer-types").then((res) => res.data),

  /** ดึงรายการวิธีชำระเงินทั้งหมด */
  getPaymentMethods: (): Promise<{ id: number; method_name: string }[]> =>
    apiClient.get<{ id: number; method_name: string }[]>("/pos/payment-methods").then((res) => res.data),

  /** สร้าง QR Code สำหรับชำระเงินผ่าน PromptPay */
  generatePromptPayQR: (orderId: number, receivedById: number): Promise<any> => 
    apiClient.post("/pos/payments/generate-qr", { order_id: orderId, received_by_id: receivedById }).then((res) => res.data),

  confirmPayment: (payload: ConfirmPaymentRequest): Promise<any> =>
    apiClient.patch("/pos/payments/confirm", payload).then((res) => res.data),

  /** ดึงประวัติการขายสินค้า (Sales History) */
  getSalesHistory: (params: SalesHistoryFilterRequest): Promise<SalesHistoryPaginationResponse> =>
    apiClient
      .get<{ data: SalesHistoryPaginationResponse; message: string }>("/pos/sales/history", { params })
      .then((res) => res.data.data), 
  
  /** ดึงประวัติการขายสินค้าตาม ID (รายละเอียดบิล) */
  getSalesHistoryById: (id: number): Promise<GetSaleHistoryByIDResponse> =>
    apiClient
      .get<{ data: GetSaleHistoryByIDResponse; message: string }>(`/pos/sales-history/${id}`)
      .then((res) => res.data.data),

  /** พนักงานส่งคำขอยกเลิกรายการขาย */
  requestCancelSaleOrder: (id: number, payload: { reason: string }): Promise<any> =>
    apiClient
      .post(`/pos/sales-history/${id}/request-cancel`, payload)
      .then((res) => res.data),

  /** เจ้าของร้านอนุมัติคำขอยกเลิกรายการขาย (และคืนสต็อกสินค้า) */
  approveCancelSaleOrder: (id: number, payload?: { remark?: string }): Promise<any> =>
    apiClient
      .post(`/pos/sales-history/${id}/approve-cancel`, payload || {})
      .then((res) => res.data),

  /** เจ้าของร้านปฏิเสธคำขอยกเลิกรายการขาย */
  rejectCancelSaleOrder: (id: number, payload?: { remark?: string }): Promise<any> =>
    apiClient
      .post(`/pos/sales-history/${id}/reject-cancel`, payload || {})
      .then((res) => res.data),
  
  /** พนักงานดูรายการคำขอยกเลิกบิลของตนเอง */
  getMyCancellationRequests: (params: SalesHistoryFilterRequest): Promise<SalesHistoryPaginationResponse> =>
    apiClient
      .get<{ data: SalesHistoryPaginationResponse; message: string }>("/pos/my-cancellation-requests", { params })
      .then((res) => res.data.data),

  /** เจ้าของร้านดูรายการคำขอยกเลิกบิลทั้งหมด */
  getCancellationRequests: (params: SalesHistoryFilterRequest): Promise<SalesHistoryPaginationResponse> =>
    apiClient
      .get<{ data: SalesHistoryPaginationResponse; message: string }>("/pos/cancellation-requests", { params })
      .then((res) => res.data.data),

  /** คืนสถานะคำขอยกเลิกบิล (พนักงานดึงคำขอกลับ) */
  revertCancellationRequest: (id: number): Promise<RevertCancellationRequestResponse> =>
    apiClient
      .post<RevertCancellationRequestResponse>(`/pos/sales-history/${id}/cancel-request/revert`)
      .then((res) => res.data),

  /** ค้นหารายการบิลที่ถูกยกเลิก (สำหรับนำมากู้คืนที่หน้า POS) */
  getCancelledOrders: (search?: string): Promise<SalesHistoryItemResponse[]> =>
    apiClient
      .get<{ data: SalesHistoryPaginationResponse; message: string }>("/pos/sales/history", {
        params: { search: search || undefined, status: "cancelled", limit: 50 },
      })
      .then((res) => res.data?.data?.items || [])
      .catch(() => []),

  /** ดึงรายชื่อพนักงาน */
  getEmployees: (): Promise<any[]> =>
    apiClient
      .get<any[]>("/pos/employees")
      .then((res) => res.data),

  /** ดึงรายการบิลค้างชำระของลูกค้าตาม customer_id */
  getUnpaidBillsByCustomer: (customerId: number): Promise<CustomerUnpaidBillsResponse> =>
    apiClient
      .get<CustomerUnpaidBillsResponse>(`/pos/payments/unpaid-bills/${customerId}`)
      .then((res) => res.data),

  /** ดึงรายการบิลค้างชำระเจาะจงเฉพาะบิลเดียวด้วยเลขที่คำสั่งซื้อ/บาร์โค้ด */
  getUnpaidBillByOrderNumber: (orderNumber: string): Promise<CustomerUnpaidBillsResponse> =>
    apiClient
      .get<CustomerUnpaidBillsResponse>(`/pos/payments/unpaid-order/${encodeURIComponent(orderNumber)}`)
      .then((res) => res.data),

  /** บันทึกรับชำระบิลค้างชำระ */
  settleCustomerBills: (payload: SettleBillsRequest): Promise<SettleBillsResponse> =>
    apiClient
      .post<SettleBillsResponse>("/pos/payments/settle-bills", payload)
      .then((res) => res.data),

  /** สร้าง PromptPay QR Code สำหรับชำระบิลค้างชำระ (ตัดยอดหนี้) */
  generateSettleQR: (payload: GenerateSettleQRRequest): Promise<GenerateSettleQRResponse> =>
    apiClient
      .post<GenerateSettleQRResponse>("/pos/payments/generate-settle-qr", payload)
      .then((res) => res.data),

  /** ดึงประวัติการรับชำระเงินทั้งหมด */
  getPaymentHistory: (params?: {
    search?: string;
    start_date?: string;
    end_date?: string;
    employee_id?: number;
  }): Promise<PaymentHistoryItem[]> =>
    apiClient
      .get<PaymentHistoryItem[] | { data: PaymentHistoryItem[] }>("/pos/payments/history", { params })
      .then((res) => (Array.isArray(res.data) ? res.data : (res.data as any)?.data || [])),

  /** พนักงานส่งคำขอยกเลิกใบเสร็จ (Repayment) */
  requestCancelPaymentReceipt: (receiptId: number, payload: RequestCancelPaymentReceiptRequest): Promise<any> =>
    apiClient
      .post(`/pos/payments/history/${receiptId}/request-cancel`, payload)
      .then((res) => res.data),

  /** พนักงานดึงคำขอยกเลิกใบเสร็จกลับ */
  revertCancelPaymentReceiptRequest: (receiptId: number): Promise<any> =>
    apiClient
      .post(`/pos/payments/history/${receiptId}/cancel-request/revert`)
      .then((res) => res.data),

  /** เจ้าของร้านอนุมัติการยกเลิกใบเสร็จ (คืนยอดหนี้) */
  approveCancelPaymentReceipt: (receiptId: number, payload?: ProcessCancelPaymentReceiptRequest): Promise<any> =>
    apiClient
      .post(`/pos/payments/history/${receiptId}/approve-cancel`, payload || {})
      .then((res) => res.data),

  /** เจ้าของร้านปฏิเสธคำขอยกเลิกใบเสร็จ */
  rejectCancelPaymentReceipt: (receiptId: number, payload?: ProcessCancelPaymentReceiptRequest): Promise<any> =>
    apiClient
      .post(`/pos/payments/history/${receiptId}/reject-cancel`, payload || {})
      .then((res) => res.data),

  /** ยกเลิกสลิป/ใบเสร็จรับเงิน (Direct Cancel) */
  cancelPaymentReceipt: (receiptId: number, payload: CancelPaymentReceiptRequest): Promise<any> =>
    apiClient
      .post(`/pos/payments/history/${receiptId}/cancel`, payload)
      .then((res) => res.data),

  /** ดูประวัติใบเสร็จที่เคยถูกยกเลิก */
  getCancelledPaymentHistory: (): Promise<CancelledPaymentItem[]> =>
    apiClient
      .get<CancelledPaymentItem[]>("/pos/payments/cancellations")
      .then((res) => (Array.isArray(res.data) ? res.data : (res.data as any)?.data || [])),

  /** ค้นหาใบสั่งซื้อขายด้วยหมายเลข invoice */
  getSaleOrderByNumber: async (orderNumber: string): Promise<any | null> => {
    const endpoints = [
      `/claims/sale-orders/number/${orderNumber}`,
      `/pos/orders/number/${orderNumber}`,
      `/pos/orders?number=${orderNumber}`,
    ];
    for (const endpoint of endpoints) {
      try {
        const res = await apiClient.get(endpoint);
        const data = res.data?.data || res.data;
        if (data) return data;
      } catch {
        // try next endpoint
      }
    }
    return null;
  },

  /** สั่งพิมพ์หรือดึงไฟล์ PDF ใบเสร็จรับเงิน / ใบส่งของชั่วคราว */
  printOrderReceipt: async (orderId: number | string, customTitle?: string): Promise<Blob> => {
    try {
      const response = await apiClient.get(`/pos/sales-history/${orderId}/print`, {
        params: customTitle ? { title: customTitle } : undefined,
        responseType: "blob",
      });
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการโหลด PDF ใบเสร็จ:", error);
      throw error;
    }
  },

  /** สั่งพิมพ์หรือดึงไฟล์ PDF ใบเสร็จรับเงิน (ชำระหนี้) */
  printPaymentReceiptPDF: async (receiptIdOrNo: number | string): Promise<Blob> => {
    try {
      const response = await apiClient.get(`/pos/payments/history/${receiptIdOrNo}/pdf`, {
        responseType: "blob",
      });
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการโหลด PDF ใบเสร็จชำระหนี้:", error);
      throw error;
    }
  },

  /** สั่งพิมพ์หรือดึงไฟล์ PDF ใบสรุปประวัติการชำระเงินและยอดค้างชำระของลูกค้า (Customer Statement) */
  printCustomerStatementPDF: async (
    customerId: number,
    startDate?: string,
    endDate?: string
  ): Promise<Blob> => {
    try {
      const response = await apiClient.get(`/pos/payments/customers/${customerId}/statement-pdf`, {
        params: { start_date: startDate || undefined, end_date: endDate || undefined },
        responseType: "blob",
      });
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการโหลด PDF สรุปประวัติการชำระเงินลูกค้า:", error);
      throw error;
    }
  },
};

// ==================== Business Logic Helpers ====================
export const calculateValidatedDiscount = (
  item: SaleOrderItemRequest,
  value: number,
  customer: CustomerDiscountResponse | null,
  activeTypeId?: number
): number => {
  const itemPrice = item.unit_price || 0;
  const currentCustomerTypeId = customer?.customer_type?.id || activeTypeId;
  const currentCustomerTypeName = customer?.customer_type?.type_name || "";

  // ลูกค้ากลุ่มบริษัท (WHOLESALE) ห้ามรับส่วนลดใดๆ ทั้งสิ้นในระบบ
  if (currentCustomerTypeId === 3 || currentCustomerTypeName === "WHOLESALE") {
    alert("ลูกค้ากลุ่มบริษัทไม่ได้รับสิทธิ์ส่วนลดใดๆ ทั้งสิ้น");
    return 0;
  }

  // ตรวจสอบสิทธิ์กลุ่มอู่ซ่อมรถ (GARAGE) และต้องเปิดใช้งานระบบส่วนลด (is_discount_enabled)
  const isDiscountEnabled = customer ? customer.is_discount_enabled : true;
  const isGarageMode = 
    isDiscountEnabled && (
      currentCustomerTypeId === 2 || 
      currentCustomerTypeName === "GARAGE" || 
      (customer?.customer_name?.includes("อู่"))
    );

  let allowedMaxDiscount = (item as any).max_discount_rate ?? 2.00;

  if (isGarageMode) {
    const ontopRate = customer ? ((customer as any).ontop_discount_rate ?? 3.00) : 3.00;
    allowedMaxDiscount += ontopRate; // เพดานขยายเป็น (Product Max + Ontop อู่)
  }

  if (item.discount_type === "percentage") {
    // ปรับการเปรียบเทียบทศนิยม ป้องกันบั๊ก floating point ของ javascript (เช่น 5.00000001 > 5)
    if (value > (allowedMaxDiscount + 0.01)) {
      alert(`เกินข้อกำหนดสูงสุด (จำกัดที่ ${allowedMaxDiscount.toFixed(2)}%)`);
      return 0;
    }
    return value;
  }

  if (item.discount_type === "amount") {
    const lineTotal = itemPrice * (item.qty || 1);
    const maxDiscountBaht = (lineTotal * allowedMaxDiscount) / 100;

    if (value > (maxDiscountBaht + 0.01)) {
      alert(`เกินข้อกำหนดสูงสุด (จำกัดที่ ฿${maxDiscountBaht.toFixed(2)})`);
      return 0;
    }
    return value;
  }

  return 0;
};

/**
 * ฟังก์ชันหาค่าส่วนลดเริ่มต้น (Default) ทันทีตอนดึงสินค้าเข้าตะกร้า
 * กฎระบบ:
 * - ถ้ายังไม่ได้เพิ่มลูกค้า (ไม่มี customer หรือเป็นลูกค้าขาจร id === 0): ไม่กรอกส่วนลดเริ่มต้นเด็ดขาด
 * - ส่วนลดจะขึ้นอัตโนมัติเฉพาะเมื่อเป็นลูกค้าอู่ (GARAGE) ที่เปิดใช้งานสิทธิ์ส่วนลด
 * - ลูกค้ากลุ่มบริษัท (WHOLESALE) ไม่ได้รับสิทธิ์ส่วนลดใดๆ
 */
export const getDefaultProductDiscount = (
  product: any,
  customer: CustomerDiscountResponse | null,
  activeTypeId?: number
): { type: "none" | "percentage" | "amount"; value: number } => {
  const currentCustomerTypeId = customer?.customer_type?.id || activeTypeId;
  const currentCustomerTypeName = customer?.customer_type?.type_name || "";

  // 1. ลูกค้ากลุ่มบริษัท (WHOLESALE) ไม่ได้รับสิทธิ์ส่วนลดใดๆ
  if (currentCustomerTypeId === 3 || currentCustomerTypeName === "WHOLESALE") {
    return { type: "none", value: 0 };
  }

  // 2. ถ้ายังไม่ได้เพิ่มลูกค้า (ไม่มี customer หรือเป็นลูกค้าขาจร/guest id === 0)
  // ยังไม่ต้องกรอกส่วนลดให้ และตรงกล่องยังไม่ต้องขึ้นว่าลด
  if (!customer || customer.id === 0) {
    return { type: "none", value: 0 };
  }

  // เพดานส่วนลดของสินค้าที่ตั้งค่าไว้ (max_discount_rate)
  const productRate = Number(product?.max_discount_rate) || 0;

  // ตรวจสอบสิทธิ์กลุ่มอู่ซ่อมรถ (GARAGE)
  const isGarage = 
    customer.customer_type?.id === 2 || 
    customer.customer_type?.type_name === "GARAGE" || 
    customer.customer_type?.type_label?.includes("อู่") ||
    customer.customer_name?.includes("อู่") ||
    activeTypeId === 2;

  // กรณี 1: ลูกค้าอู่ซ่อมรถ และ เปิดใช้งานส่วนลดระบบ -> ให้ส่วนลดอัตโนมัติ (ส่วนลดสินค้า + On-Top)
  if (isGarage && customer.is_discount_enabled !== false) {
    const ontopRate = Number((customer as any).ontop_discount_rate) || 0;
    const baseRate = productRate > 0 ? productRate : 0;
    const totalRate = baseRate + ontopRate;
    if (totalRate > 0) {
      return { type: "percentage", value: totalRate };
    }
    return { type: "none", value: 0 };
  }

  // กรณี 2: ลูกค้าประจำที่มีสิทธิ์ส่วนลดเฉพาะตัว (standard_discount_rate)
  if (customer.is_discount_enabled !== false && Number(customer.standard_discount_rate) > 0) {
    const stdRate = Number(customer.standard_discount_rate);
    const rate = productRate > 0 ? Math.min(stdRate, productRate) : stdRate;
    if (rate > 0) {
      return { type: "percentage", value: rate };
    }
    return { type: "none", value: 0 };
  }

  // กรณีอื่นๆ (เช่น ลูกค้าทั่วไป ที่ไม่ได้เป็นลูกค้าอู่): ไม่ตั้งส่วนลดอัตโนมัติ
  return { type: "none", value: 0 };
};