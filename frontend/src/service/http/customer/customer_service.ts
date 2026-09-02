import apiClient from "../apiClient";
import type {
  CustomerTypeItem,
  CustomerListItem,
  CustomerDetailResponse,
  RegisterCustomerRequest,
  UpdateCustomerDiscountRequest,
} from "../../../interface/customer/customer_interface";
import type { CustomerDiscountResponse } from "../../../interface/pos/customer_interface";
import type { BulkUpdateCustomerDiscountItem, CustomerCreditAuditLog } from "../../../interface/storeconfig/customer_credit_interface";

export const customerApiService = {
  /** ดึงรายชื่อประเภทลูกค้าสำหรับ Dropdown */
  getCustomerTypes: async (): Promise<CustomerTypeItem[]> => {
    const res = await apiClient.get<CustomerTypeItem[]>("/pos/customer-types");
    return res.data || [];
  },

  /** ดึงรายการลูกค้าทั้งหมด */
  getCustomers: async (): Promise<CustomerListItem[]> => {
    const res = await apiClient.get<CustomerListItem[]>("/customers");
    return res.data || [];
  },

  /** ดึงรายละเอียดลูกค้าตาม ID */
  getCustomerById: async (id: number): Promise<CustomerDetailResponse> => {
    const res = await apiClient.get<CustomerDetailResponse>(`/customers/${id}`);
    return res.data;
  },

  /** ลงทะเบียนลูกค้าใหม่ */
  registerCustomer: async (payload: RegisterCustomerRequest): Promise<any> => {
    const res = await apiClient.post("/customers/register", payload);
    return res.data;
  },

  /** ค้นหา/ดึงข้อมูลสิทธิ์ส่วนลดและวงเงินเครดิตลูกค้า */
  getCustomerDiscounts: async (query: string = ""): Promise<CustomerDiscountResponse[]> => {
    const res = await apiClient.get<CustomerDiscountResponse[]>(
      `/pos/customer-discount?search=${encodeURIComponent(query)}`
    );
    return res.data || [];
  },

  /** อัปเดตสิทธิ์ส่วนลดพิเศษ On-top ของลูกค้า (PUT /api/customers/:id/discount) */
  updateCustomerDiscount: async (
    id: number,
    payload: UpdateCustomerDiscountRequest
  ): Promise<any> => {
    const res = await apiClient.put(`/customers/${id}/discount`, payload);
    return res.data;
  },

  /** บันทึกแก้ไขส่วนลดลูกค้าจำนวนมาก (Bulk Update) */
  bulkUpdateCustomerDiscounts: async (
    items: BulkUpdateCustomerDiscountItem[]
  ): Promise<any> => {
    const res = await apiClient.put("/pos/customer-discount", {
      discount_items: items,
    });
    return res.data;
  },

  /** ดึงประวัติการแก้ไขสิทธิ์และเครดิตลูกค้า (GET /api/customers/credit/audit-logs) */
  getCustomerCreditAuditLogs: async (): Promise<CustomerCreditAuditLog[]> => {
    const res = await apiClient.get<CustomerCreditAuditLog[]>("/customers/credit/audit-logs");
    return res.data || [];
  },

  /** บันทึกประวัติการแก้ไขสิทธิ์และเครดิตลูกค้า (POST /api/customers/credit/audit-logs) */
  createCustomerCreditAuditLog: async (payload: {
    customer_id?: number;
    customer_name: string;
    action: string;
    details: string;
  }): Promise<any> => {
    const res = await apiClient.post("/customers/credit/audit-logs", payload);
    return res.data;
  },
};