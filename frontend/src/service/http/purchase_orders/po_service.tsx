import apiClient from "../apiClient"; // คุณ Import มาแล้วแต่ไม่ได้ใช้
import type { CreatePORequest, CreatePOResponse } from '../../../interface/purchase_orders/create_po_interface'; 
import type { GetPOsResponse, GetPOsParams, POSummaryResponse } from '../../../interface/purchase_orders/po_interface';

export const poService = {
  
  getPurchaseOrders: async (params: GetPOsParams): Promise<GetPOsResponse> => {
    try {
      const queryParams: Record<string, any> = {
        page: params.page,
        limit: params.limit,
      };

      if (params.status && params.status !== "all") queryParams.status = params.status;
      if (params.search) queryParams.search = params.search;
      if (params.date) queryParams.date = params.date;

      // เปลี่ยนจาก axios.get เป็น apiClient.get
      // และไม่ต้องใส่ API_BASE_URL ซ้ำซ้อนแล้ว
      const response = await apiClient.get<GetPOsResponse>(
        '/po/get-all-po', 
        { params: queryParams }
      );
      
      return response.data;
      
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูลใบสั่งซื้อ:", error);
      throw error; 
    }
  },

  createPurchaseOrder: async (payload: CreatePORequest): Promise<CreatePOResponse> => {
    try {
      // เปลี่ยนจาก axios.post เป็น apiClient.post
      const response = await apiClient.post<CreatePOResponse>(
        '/po/new-purchase-orders', 
        payload
      );
      
      return response.data; 
      
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการสร้างใบสั่งซื้อ:", error);
      throw error; 
    }
  },

  getPurchaseOrderSummary: async (): Promise<POSummaryResponse> => {
    try {
      const response = await apiClient.get<POSummaryResponse>('/po/summary');
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูลสรุปยอด:", error);
      throw error; 
    }
  },
};