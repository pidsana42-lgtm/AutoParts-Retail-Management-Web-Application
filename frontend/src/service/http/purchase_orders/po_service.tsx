import apiClient from "../apiClient"; // คุณ Import มาแล้วแต่ไม่ได้ใช้
import type { GetPOsResponse, GetPOsParams, POSummaryResponse, CreatePORequest, CreatePOResponse, 
  ProductSearchResponse, LocalPOItem, PreorderItem } from '../../../interface/purchase_orders/po_interface'; 

export const poService = {
  
  // 1. ดึงข้อมูลใบสั่งซื้อทั้งหมดพร้อม Filter
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

  // 2. สร้างใบสั่งซื้อฉบับร่าง/ใหม่
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
  printPurchaseOrder: async (id: number | string): Promise<Blob> => {
    try {
      const response = await apiClient.get(`/po/print/${id}`, {
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
      const response = await apiClient.get<{ data: ProductSearchResponse[] }>('/products/search', {
        params: { 
          q: keyword,
          supplier_id: supplierId // ส่ง ID ของบริษัทไปกรองข้อมูลหลังบ้าน
        }
      });
      return response.data.data;
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการค้นหา:", error);
      throw error;
    }
  },

  getStockAlertsBySupplier: async (supplierId: string | number): Promise<LocalPOItem[]> => {
    try {
      // 1. เรียก API เพื่อดึงข้อมูล Stock Alert ของ Supplier ที่เลือก
      const response = await apiClient.get('/wms/stock-alerts', { 
        params: { supplier_id: supplierId } 
      });

      // สมมติว่า response.data ส่งข้อมูลกลับมาเป็น Array ของ POItemResponse
      const rawData = response.data;

      // 2. Map ข้อมูลเพื่อเติม order_type เข้าไปสำหรับใช้ใน Frontend
      const alertItems: LocalPOItem[] = rawData.map((item: any) => ({
        id: item.id || Date.now() + Math.random(), // ใช้ id จาก DB หรือสร้างชั่วคราวถ้าไม่มี
        product_id: item.product_id,
        product_name_snapshot: item.product_name_snapshot,
        product_name_code_snapshot: item.product_name_code_snapshot,
        quantity: item.quantity || 1, // จำนวนที่แนะนำให้สั่งซื้อ
        unit: item.unit,
        unit_price: item.unit_price,
        sub_total: (item.quantity || 1) * item.unit_price,
        order_type: 'สั่งซื้อ' // เติม Local State ตรงนี้
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
      const response = await apiClient.get('/wms/pre-orders', {
        params: {
          status: 'PENDING'
        }
      });
      return response.data.data || response.data || [];     
    } catch (error) {
      console.error(`ไม่สามารถดึงข้อมูลพรีออเดอร์ทั้งหมดได้:`, error);
      throw error;
    }
  },
};