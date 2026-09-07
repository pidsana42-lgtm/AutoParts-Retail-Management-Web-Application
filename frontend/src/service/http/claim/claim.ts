import apiClient from '../apiClient';
import type { 
  SalesReturn, 
  CustomerClaim, 
  CustomerClaimItem,
  SupplierClaim 
} from '../../../interface/claim/claim';

// ==========================================
// Sales Return HTTP Services
// ==========================================
export const getSalesReturns = async () => {
  const response = await apiClient.get<{ data: SalesReturn[] }>('/claims/sales-returns');
  return response.data?.data ?? [];
};

export const getSalesReturnById = async (id: number) => {
  const response = await apiClient.get<{ data: SalesReturn }>(`/claims/sales-returns/${id}`);
  return response.data?.data ?? null;
};

export const createSalesReturn = async (data: SalesReturn) => {
  const response = await apiClient.post<{ data: SalesReturn }>('/claims/sales-returns', data);
  return response.data?.data ?? null;
};

export const updateSalesReturn = async (id: number, data: SalesReturn) => {
  const response = await apiClient.put<{ data: SalesReturn }>(`/claims/sales-returns/${id}`, data);
  return response.data?.data ?? null;
};

export const deleteSalesReturn = async (id: number) => {
  const response = await apiClient.delete<{ message: string }>(`/claims/sales-returns/${id}`);
  return response.data;
};

// ==========================================
// Customer Claim HTTP Services
// ==========================================
export const getCustomerClaims = async () => {
  const response = await apiClient.get<{ data: CustomerClaim[] }>('/claims/customer-claims');
  return response.data?.data ?? [];
};

export const getCustomerClaimById = async (id: number) => {
  const response = await apiClient.get<{ data: CustomerClaim }>(`/claims/customer-claims/${id}`);
  return response.data?.data ?? null;
};

export const createCustomerClaim = async (data: CustomerClaim) => {
  const response = await apiClient.post<{ data: CustomerClaim }>('/claims/customer-claims', data);
  return response.data?.data ?? null;
};

export const updateCustomerClaim = async (id: number, data: CustomerClaim) => {
  const response = await apiClient.put<{ data: CustomerClaim }>(`/claims/customer-claims/${id}`, data);
  return response.data?.data ?? null;
};

export const deleteCustomerClaim = async (id: number) => {
  const response = await apiClient.delete<{ message: string }>(`/claims/customer-claims/${id}`);
  return response.data;
};

export const updateClaimItemStatus = async (itemId: number, status: string) => {
  const response = await apiClient.put<{ data: CustomerClaimItem }>(`/claims/customer-claims/items/${itemId}/status`, { status });
  return response.data?.data ?? null;
};

// ==========================================
// Supplier Claim HTTP Services
// ==========================================
export const getSupplierClaims = async () => {
  const response = await apiClient.get<{ data: SupplierClaim[] }>('/claims/supplier-claims');
  return response.data?.data ?? [];
};

export const getSupplierClaimById = async (id: number) => {
  const response = await apiClient.get<{ data: SupplierClaim }>(`/claims/supplier-claims/${id}`);
  return response.data?.data ?? null;
};

export const createSupplierClaim = async (data: SupplierClaim) => {
  const response = await apiClient.post<{ data: SupplierClaim }>('/claims/supplier-claims', data);
  return response.data?.data ?? null;
};

export const updateSupplierClaim = async (id: number, data: SupplierClaim) => {
  const response = await apiClient.put<{ data: SupplierClaim }>(`/claims/supplier-claims/${id}`, data);
  return response.data?.data ?? null;
};

export const deleteSupplierClaim = async (id: number) => {
  const response = await apiClient.delete<{ message: string }>(`/claims/supplier-claims/${id}`);
  return response.data;
};

// ==========================================
// Sale Order Lookup (for customer claim form)
// ==========================================
export const getSaleOrderByNumber = async (orderNumber: string) => {
  const response = await apiClient.get<{ data: any }>(`/claims/sale-orders/number/${orderNumber}`);
  return response.data?.data ?? null;
};

export const searchSaleOrders = async (q: string) => {
  const response = await apiClient.get<{ data: any[] }>(`/claims/sale-orders/search?q=${encodeURIComponent(q)}`);
  return response.data?.data ?? [];
};

// ==========================================
// Customer Credit Lookup (for claim forms)
// ==========================================
export const searchCustomerCreditByPhone = async (phone: string) => {
  const response = await apiClient.get<any>(`/pos/customer-discount?search=${encodeURIComponent(phone)}`);
  if (Array.isArray(response.data)) {
    return response.data[0] || null;
  }
  return response.data || null;
};

// ==========================================
// Customer Claim PDF Export
// ==========================================
export const generateCustomerClaimPDF = async (id: number): Promise<Blob> => {
  try {
    const response = await apiClient.get(`/claims/customer-claims/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการโหลด PDF ใบรับเคลม:", error);
    throw error;
  }
};

export const exportCustomerClaimChecklistPDF = async (status?: string, search?: string): Promise<Blob> => {
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);

    const response = await apiClient.get(`/claims/customer-claims/export/checklist-pdf?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการสร้าง PDF ใบเช็คลิสต์เคลม:", error);
    throw error;
  }
};

