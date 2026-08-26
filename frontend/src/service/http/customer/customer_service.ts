import apiClient from "../apiClient";
import type {
  CustomerTypeItem,
  CustomerListItem,
  CustomerDetailResponse,
} from "../../../interface/customer/customer_interface";

export const customerApiService = {
  /** ดึงรายชื่อประเภทลูกค้าสำหรับ Dropdown */
  getCustomerTypes: async (): Promise<CustomerTypeItem[]> => {
    const res = await apiClient.get<CustomerTypeItem[]>("/pos/customer-types");
    return res.data || [];
  },

  /** ดึงรายการลูกค้าทั้งหมด */
  getCustomers: async (): Promise<CustomerListItem[]> => {
    const res = await apiClient.get<CustomerListItem[]>("/api/customers");
    return res.data || [];
  },

  /** ดึงรายละเอียดลูกค้าตาม ID */
  getCustomerById: async (id: number): Promise<CustomerDetailResponse> => {
    const res = await apiClient.get<CustomerDetailResponse>(`/api/customers/${id}`);
    return res.data;
  },

  /** ลงทะเบียนลูกค้าใหม่ */
  registerCustomer: async (formData: FormData): Promise<any> => {
    const res = await apiClient.post("/api/customers/register", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },
};