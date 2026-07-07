import apiClient from '../apiClient';
import type { 
  SalesReturn, 
  CustomerClaim, 
  SupplierClaim 
} from '../../../interface/claim/claim';

// ==========================================
// Sales Return HTTP Services
// ==========================================
export const getSalesReturns = async () => {
  const response = await apiClient.get<{ data: SalesReturn[] }>('/claims/sales-returns');
  return response.data.data;
};

export const getSalesReturnById = async (id: number) => {
  const response = await apiClient.get<{ data: SalesReturn }>(`/claims/sales-returns/${id}`);
  return response.data.data;
};

export const createSalesReturn = async (data: SalesReturn) => {
  const response = await apiClient.post<{ data: SalesReturn }>('/claims/sales-returns', data);
  return response.data.data;
};

export const updateSalesReturn = async (id: number, data: SalesReturn) => {
  const response = await apiClient.put<{ data: SalesReturn }>(`/claims/sales-returns/${id}`, data);
  return response.data.data;
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
  return response.data.data;
};

export const getCustomerClaimById = async (id: number) => {
  const response = await apiClient.get<{ data: CustomerClaim }>(`/claims/customer-claims/${id}`);
  return response.data.data;
};

export const createCustomerClaim = async (data: CustomerClaim) => {
  const response = await apiClient.post<{ data: CustomerClaim }>('/claims/customer-claims', data);
  return response.data.data;
};

export const updateCustomerClaim = async (id: number, data: CustomerClaim) => {
  const response = await apiClient.put<{ data: CustomerClaim }>(`/claims/customer-claims/${id}`, data);
  return response.data.data;
};

export const deleteCustomerClaim = async (id: number) => {
  const response = await apiClient.delete<{ message: string }>(`/claims/customer-claims/${id}`);
  return response.data;
};

// ==========================================
// Supplier Claim HTTP Services
// ==========================================
export const getSupplierClaims = async () => {
  const response = await apiClient.get<{ data: SupplierClaim[] }>('/claims/supplier-claims');
  return response.data.data;
};

export const getSupplierClaimById = async (id: number) => {
  const response = await apiClient.get<{ data: SupplierClaim }>(`/claims/supplier-claims/${id}`);
  return response.data.data;
};

export const createSupplierClaim = async (data: SupplierClaim) => {
  const response = await apiClient.post<{ data: SupplierClaim }>('/claims/supplier-claims', data);
  return response.data.data;
};

export const updateSupplierClaim = async (id: number, data: SupplierClaim) => {
  const response = await apiClient.put<{ data: SupplierClaim }>(`/claims/supplier-claims/${id}`, data);
  return response.data.data;
};

export const deleteSupplierClaim = async (id: number) => {
  const response = await apiClient.delete<{ message: string }>(`/claims/supplier-claims/${id}`);
  return response.data;
};
