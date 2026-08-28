import apiClient from '../apiClient';
import type { GetReturnsParams, GetReturnsResponse, ReturnableSaleOrder, SalesReturn } from '../../../interface/return/return_interface';

export const returnService = {
  /**
   * ดึงรายการคืนสินค้าทั้งหมด พร้อมจำนวนนับตามสถานะ และ pagination
   */
  getReturns: async (params?: GetReturnsParams): Promise<GetReturnsResponse> => {
    try {
      const response = await apiClient.get<GetReturnsResponse>('/returns', { params });
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูลรายการคืนสินค้า:", error);
      throw error;
    }
  },

  /**
   * ดึงข้อมูลการคืนสินค้าตาม ID
   */
  getReturnById: async (id: number): Promise<SalesReturn | null> => {
    try {
      const response = await apiClient.get<{ data: SalesReturn }>(`/returns/${id}`);
      return response.data?.data ?? null;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูลการคืนสินค้า:", error);
      throw error;
    }
  },

  /**
   * สร้างรายการคืนสินค้าใหม่
   */
  createSalesReturn: async (data: Partial<SalesReturn>): Promise<SalesReturn | null> => {
    try {
      const response = await apiClient.post<{ data: SalesReturn }>('/returns', data);
      return response.data?.data ?? null;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการสร้างรายการคืนสินค้า:", error);
      throw error;
    }
  },

  /**
   * อัปเดตรายการคืนสินค้า
   */
  updateSalesReturn: async (id: number, data: Partial<SalesReturn>): Promise<SalesReturn | null> => {
    try {
      const response = await apiClient.put<{ data: SalesReturn }>(`/returns/${id}`, data);
      return response.data?.data ?? null;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการอัปเดตรายการคืนสินค้า:", error);
      throw error;
    }
  },

  /**
   * ลบรายการคืนสินค้า
   */
  processRefund: async (id: number): Promise<SalesReturn | null> => {
    try {
      const response = await apiClient.post<{ data: SalesReturn }>(`/returns/${id}/refund`);
      return response.data?.data ?? null;
    } catch (error) {
      console.error('Failed to process return refund:', error);
      throw error;
    }
  },

  deleteSalesReturn: async (id: number): Promise<{ message: string }> => {
    try {
      const response = await apiClient.delete<{ message: string }>(`/returns/${id}`);
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการลบรายการคืนสินค้า:", error);
      throw error;
    }
  },

  /**
   * ค้นหาใบขาย/ใบเสร็จด้วยเลขที่ใบเสร็จหรือชื่อลูกค้า เพื่อดึงรายการสินค้าที่คืนได้
   * ใช้เฉพาะหน้า "สร้างรายการคืนสินค้าใหม่" — แยกจาก searchSaleOrders ของฝั่ง Claim
   */
  searchReturnableSaleOrders: async (search: string): Promise<ReturnableSaleOrder[]> => {
    try {
      const response = await apiClient.get<{ data: ReturnableSaleOrder[] }>('/returns/sale-orders/search', {
        params: { search },
      });
      return response.data?.data ?? [];
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการค้นหาใบขาย:", error);
      throw error;
    }
  },
};

export default returnService;
