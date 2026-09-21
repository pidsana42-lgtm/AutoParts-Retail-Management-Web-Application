import apiClient from "../apiClient";

export interface CheckStockSchedule {
  id: number;
  scheduled_datetime: string;
  scheduled_end_datetime: string;
  status: string;
  note: string;
  created_at: string;
  
  check_type: "LOCATION" | "CATEGORY" | "PRODUCT";
  // เป้าหมายการตรวจ — เลือกได้หลายจุดพร้อมกันในการมอบหมายครั้งเดียว (ตารางเก่าที่มีแค่เป้าหมายเดียวจะถูก backend
  // wrap เป็น array 1 ช่องมาให้เหมือนกัน ใช้ตรรกะเดียวกันได้ทั้งตารางเก่า/ใหม่)
  zone_ids?: number[];
  shelf_ids?: number[];
  shelf_level_ids?: number[];
  category_ids?: number[];
  sub_category_ids?: number[];
  sub_sub_category_ids?: number[];
  product_ids?: number[];
  // excluded_product_ids: สินค้าที่เจ้าของร้านเอาออกจากรายการที่ระบบหามาให้อัตโนมัติ (เฉพาะ LOCATION/CATEGORY)
  excluded_product_ids?: number[];

  user_id?: number;
  user_full_name: string;
  // รหัสเฉพาะของตารางนี้ ผูกกับ QR Code ให้พนักงานสแกนเข้าหน้าเช็คสต็อกได้เลยโดยไม่ต้องล็อกอินในมือถือก่อน
  access_token: string;

  target_name: string;
  product_count: number;
}

export interface CheckStockScheduleCreateInput {
  scheduled_datetime: string;
  scheduled_end_datetime: string;
  note: string;
  check_type: "LOCATION" | "CATEGORY" | "PRODUCT";
  zone_ids?: number[];
  shelf_ids?: number[];
  shelf_level_ids?: number[];
  category_ids?: number[];
  sub_category_ids?: number[];
  sub_sub_category_ids?: number[];
  product_ids?: number[];
  excluded_product_ids?: number[];
  user_id?: number;
}

export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
}

// 1 รายการ = ผลนับสต็อกของสินค้า 1 ชิ้น ภายใต้ตารางเช็คสต็อกหนึ่งๆ (ที่มา: /wms/check-stocks)
export interface CheckStockRecord {
  id: number;
  old_quantity: number;
  new_quantity: number;
  diff_quantity: number;
  reason: string;
  adjustment_datetime: string;
  product_id: number;
  supplier_id?: number;
  user_id: number;
  check_stock_schedule_id?: number;
  created_at: string;
}

export interface CheckStockRecordInput {
  old_quantity: number;
  new_quantity: number;
  reason?: string;
  adjustment_datetime: string;
  product_id: number;
  // supplier_id: ระบุเมื่อแถวนี้นับแยกเฉพาะบริษัทใดบริษัทหนึ่ง (สินค้าที่มีมากกว่า 1 บริษัท) — ไม่ระบุ = ปรับแค่
  // ยอดรวมสินค้าอย่างเดียว ไม่มี Inventory ให้ปรับ (เช่นส่วนต่างที่หาที่มาไม่ได้)
  supplier_id?: number;
  user_id: number;
  check_stock_schedule_id: number;
}

export const stockCheckService = {
  getEmployees: async (): Promise<Employee[]> => {
    const res = await apiClient.get<Employee[]>("/wms/check-stock-schedules/employees");
    return res.data || [];
  },

  getZoneTree: async (): Promise<any[]> => {
    const res = await apiClient.get<any[]>("/wms/check-stock-schedules/options/zone-tree");
    return res.data || [];
  },

  getCategoryTree: async (): Promise<any[]> => {
    const res = await apiClient.get<any[]>("/wms/check-stock-schedules/options/category-tree");
    return res.data || [];
  },

  getSchedules: async (status?: string): Promise<CheckStockSchedule[]> => {
    const url = status ? `/wms/check-stock-schedules?status=${status}` : "/wms/check-stock-schedules";
    const res = await apiClient.get<CheckStockSchedule[]>(url);
    return res.data || [];
  },
  
  getScheduleById: async (id: number): Promise<CheckStockSchedule> => {
    const res = await apiClient.get<CheckStockSchedule>(`/wms/check-stock-schedules/${id}`);
    return res.data;
  },

  createSchedule: async (data: CheckStockScheduleCreateInput): Promise<{ message: string; id: number }> => {
    const res = await apiClient.post<{ message: string; id: number }>("/wms/check-stock-schedules", data);
    return res.data;
  },

  updateSchedule: async (id: number, data: CheckStockScheduleCreateInput): Promise<any> => {
    const res = await apiClient.put(`/wms/check-stock-schedules/${id}`, data);
    return res.data;
  },

  updateStatus: async (id: number, status: string): Promise<any> => {
    const res = await apiClient.patch(`/wms/check-stock-schedules/${id}/status`, { status });
    return res.data;
  },

  // เจ้าของร้านอนุมัติผลนับสต็อกที่พนักงานส่งมา -> ระบบเซ็ตสต็อกจริงตามที่นับได้ + ปิดตารางเป็น "เสร็จสิ้น"
  approveSchedule: async (id: number): Promise<any> => {
    const res = await apiClient.post(`/wms/check-stock-schedules/${id}/approve`);
    return res.data;
  },

  // เจ้าของร้านตีกลับให้พนักงานนับใหม่ (ลบผลนับเดิม เปิดสถานะกลับเป็น "กำลังเช็ค")
  rejectSchedule: async (id: number, note?: string): Promise<any> => {
    const res = await apiClient.post(`/wms/check-stock-schedules/${id}/reject`, { note: note || "" });
    return res.data;
  },

  deleteSchedule: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/check-stock-schedules/${id}`);
    return res.data;
  },
};

// บันทึกผลนับสต็อกรายชิ้น (ที่มาของสต็อกจริงตอนเจ้าของร้านกดอนุมัติ) — แยก service เพราะเป็นคนละ endpoint (/wms/check-stocks)
export const checkStockRecordService = {
  create: async (data: CheckStockRecordInput): Promise<any> => {
    const res = await apiClient.post("/wms/check-stocks", data);
    return res.data;
  },

  listBySchedule: async (scheduleId: number): Promise<CheckStockRecord[]> => {
    const res = await apiClient.get<CheckStockRecord[]>(`/wms/check-stocks?schedule_id=${scheduleId}`);
    return res.data || [];
  },
};
