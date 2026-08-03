import apiClient from "../apiClient";
import type { GetPOsResponse, GetPOsParams, POSummaryResponse, CreatePORequest, CreatePOResponse, 
  ProductSearchResponse, LocalPOItem, PreorderItem, UpdatePORequest, UpdatePOResponse, POResponse,
  POAnalyticsResponse, PreOrderRaw, PreOrderItemRaw } from '../../../interface/purchase_orders/po_interface'; 
import { generateLocalId } from "../../../utils/generateId";

export const poService = {
  // 1. ดึงข้อมูลใบสั่งซื้อทั้งหมดพร้อม Filter
  getPurchaseOrders: async (params: GetPOsParams): Promise<GetPOsResponse> => {
    try {
      const queryParams: Record<string, any> = { page: params.page, limit: params.limit };
      if (params.status && params.status !== "all") queryParams.status = params.status;
      if (params.search) queryParams.search = params.search;
      if (params.month) queryParams.month = params.month;
      const response = await apiClient.get<GetPOsResponse>('/po/get-all-po', { params: queryParams });
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูลใบสั่งซื้อ:", error);
      throw error; 
    }
  },

  // 2. สร้างใบสั่งซื้อฉบับร่าง/ใหม่
  createPurchaseOrder: async (payload: CreatePORequest): Promise<CreatePOResponse> => {
    try {
      const response = await apiClient.post<CreatePOResponse>('/po/new-po', payload);
      return response.data; 
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการสร้างใบสั่งซื้อ:", error);
      throw error; 
    }
  },

  // 3. ดึงข้อมูลสรุปยอด (รวมข้อมูลแยกตามซัพพลายเออร์ที่ไม่อนุมัติ)
  getPurchaseOrderSummary: async (): Promise<POSummaryResponse> => {
    try {
      const response = await apiClient.get<POSummaryResponse>('/po/summary');
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูลสรุปยอด:", error);
      throw error; 
    }
  },

  // 4. สั่งพิมพ์/ดึงไฟล์ PDF ใบสั่งซื้อ
  printPurchaseOrder: async (id: number | string, includeCode: boolean): Promise<Blob> => {
    try {
      const response = await apiClient.get(`/po/print/${id}`, {
        params: {
          include_code: includeCode, // ส่งเป็น query param ?include_code=true/false
        },
        responseType: 'blob', // สำคัญมาก: บอก axios ว่ารับข้อมูลเป็นไฟล์ Binary (PDF)
      });
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการโหลด PDF:", error);
      throw error;
    }
  },

  // 5. ค้นหาสินค้า
  searchProduct: async (keyword: string, supplierId: string | number): Promise<ProductSearchResponse[]> => {
    try {
      const response = await apiClient.get<{ data: ProductSearchResponse[] }>('/po/product-search', {
        params: { q: keyword, supplier_id: supplierId }
      });
      return response.data.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการค้นหา:", error);
      throw error;
    }
  },

  // 6. เรียก Stock Alerts มาแสดง
  getStockAlertsBySupplier: async (supplierId: string | number): Promise<LocalPOItem[]> => {
    try {
      const response = await apiClient.get('/wms/stock-alerts', { params: { supplier_id: supplierId } });
      const rawData = response.data;
      const alertItems: LocalPOItem[] = rawData.map((item: any) => ({
        id: item.id || generateLocalId(), 
        product_id: item.product_id,
        product_name_snapshot: item.product_name_snapshot,
        product_name_code_snapshot: item.product_name_code_snapshot,
        quantity: item.quantity || 1,
        unit: item.unit,
        unit_price: item.unit_price,
        sub_total: (item.quantity || 1) * item.unit_price,
        order_type: 'สั่งซื้อ'
    }));
    return alertItems;        
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูล Stock Alert:", error);
      throw error;
    }
  },

  // 7. ดึงข้อมูลพรีออเดอร์ทั้งหมด
  getPendingPreorders: async (): Promise<PreorderItem[]> => {
    try {
      const response = await apiClient.get('/wms/pre-orders/for-po-selection', { params: { status: 'PENDING' } });
      const preOrders: PreOrderRaw[] = response.data.data || response.data || [];
      const pendingItems: PreorderItem[] = [];
      preOrders.forEach((order: PreOrderRaw) => {
        if (order.status === 'PENDING' && order.pre_order_items && Array.isArray(order.pre_order_items)) {
          order.pre_order_items.forEach((item: PreOrderItemRaw) => {
            pendingItems.push({
              id: item.id,
              pre_order_id: order.id,
              product_id: item.product_id,
              product_code: item.product?.product_code || item.product_code || '-',
              product_name: item.product?.product_name || item.product_name || `รหัสสินค้า: ${item.product_id}`,
              quantity: item.quantity,
              unit_price: item.unit_price,
              unit: item.product?.unit?.unit_name || item.unit || 'ไม่ระบุ',
            });
          });
        }
      });
      return pendingItems;
    } catch (error) {
      console.error(`ไม่สามารถดึงข้อมูลพรีออเดอร์ทั้งหมดได้:`, error);
      throw error;
    }
  },

  // 8. แก้ไขใบสั่งซื้อ (สำหรับ save draft ที่แก้ไขแล้ว)
  updatePurchaseOrder: async (id: number | string, payload: UpdatePORequest): Promise<UpdatePOResponse> => {
    try {
      const response = await apiClient.put<UpdatePOResponse>(`/po/${id}`, payload);
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการแก้ไขใบสั่งซื้อ:", error);
      throw error;
    }
  },

  // 9. ลบใบสั่งซื้อแบบ Soft Delete
  deletePurchaseOrder: async (id: number | string) => {
    try {
      const response = await apiClient.delete(`/po/${id}`); 
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 10. ดึงข้อมูลใบสั่งซื้อผ่าน ID
  getPurchaseOrderById: async (id: number | string): Promise<POResponse> => {
    try {
      const response = await apiClient.get<POResponse>(`/po/${id}`);
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูลใบสั่งซื้อ:", error);
      throw error;
    }
  },

  // 11. อัพเดตสถานะ PO (อนุมัติ / ไม่อนุมัติ)
  updatePOStatus: async ( id: number | string, 
      status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'RESUBMITTED',
      rejectionReason?: string
  ): Promise<{ message: string }> => {
      try {
          const payload: any = { status };
          if (rejectionReason) {
              payload.rejection_reason = rejectionReason;
          }
          const response = await apiClient.patch<{ message: string }>(`/po/${id}/status`, payload);
          return response.data;
      } catch (error) {
          console.error("เกิดข้อผิดพลาดในการอัพเดตสถานะใบสั่งซื้อ:", error);
          throw error;
      }
  },

  // 12. ดึงข้อมูลคาดการณ์ระยะเวลาจัดส่งของ Supplier
  getSupplierDeliveryEstimate: async (supplierId: string | number): Promise<POAnalyticsResponse> => {
    try {
      const response = await apiClient.get<POAnalyticsResponse>(`/po/suppliers/${supplierId}/delivery-estimate`);
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูลคาดการณ์การจัดส่ง:", error);
      throw error;
    }
  },

  // 13. ดึงจำนวนใบสั่งซื้อทั้งหมดของเดือนนี้ (ทุก role เรียกได้ ไม่ต้องเป็น Owner)
  getMonthlyCount: async (): Promise<{ total_count: number }> => {
    try {
      const response = await apiClient.get<{ total_count: number }>(`/po/monthly-count`);
      return response.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงจำนวนใบสั่งซื้อของเดือนนี้:", error);
      throw error;
    }
  },
};