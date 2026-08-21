import apiClient from '../apiClient';
import type { PreOrder } from '../../../interface/pre-order/pre-order';

export const getPreOrders = async (status?: string) => {
  const response = await apiClient.get<{ data: PreOrder[] }>('/wms/pre-orders', {
    params: status ? { status } : {},
  });
  return response.data.data;
};

export const getPreOrderById = async (id: number) => {
  const response = await apiClient.get<{ data: PreOrder }>(`/wms/pre-orders/${id}`);
  return response.data.data;
};

export const createPreOrder = async (data: Partial<PreOrder>) => {
  const response = await apiClient.post<{ data: PreOrder }>('/wms/pre-orders', data);
  return response.data.data;
};

export const updatePreOrder = async (id: number, data: Partial<PreOrder>) => {
  const response = await apiClient.put<{ data: PreOrder }>(`/wms/pre-orders/${id}`, data);
  return response.data.data;
};

export const deletePreOrder = async (id: number) => {
  const response = await apiClient.delete<{ message: string }>(`/wms/pre-orders/${id}`);
  return response.data;
};
