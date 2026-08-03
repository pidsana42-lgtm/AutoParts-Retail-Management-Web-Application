import apiClient from "../apiClient";

export interface CheckStockSchedule {
  id: number;
  scheduled_datetime: string;
  status: string;
  note: string;
  created_at: string;
  
  check_type: "LOCATION" | "CATEGORY" | "PRODUCT";
  zone_id?: number;
  shelf_id?: number;
  shelf_level_id?: number;
  category_id?: number;
  sub_category_id?: number;
  sub_sub_category_id?: number;
  product_id?: number;
  
  user_id: number;
  user_full_name: string;
  
  target_name: string;
  product_count: number;
}

export interface CheckStockScheduleCreateInput {
  scheduled_datetime: string;
  note: string;
  check_type: "LOCATION" | "CATEGORY" | "PRODUCT";
  zone_id?: number;
  shelf_id?: number;
  shelf_level_id?: number;
  category_id?: number;
  sub_category_id?: number;
  sub_sub_category_id?: number;
  product_id?: number;
  user_id: number;
}

export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
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

  createSchedule: async (data: CheckStockScheduleCreateInput): Promise<any> => {
    const res = await apiClient.post("/wms/check-stock-schedules", data);
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

  deleteSchedule: async (id: number): Promise<any> => {
    const res = await apiClient.delete(`/wms/check-stock-schedules/${id}`);
    return res.data;
  },
};
