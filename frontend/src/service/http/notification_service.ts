import apiClient from "./apiClient";

export interface NotificationRecord {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  check_stock_schedule_id?: number;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: NotificationRecord[];
  unread_count: number;
}

// role/userId มาจาก useAuth() — เจ้าของร้าน/แอดมินเห็นแจ้งเตือนของทั้งร้าน ส่วนพนักงานเห็นเฉพาะของตัวเอง
export const notificationService = {
  list: async (role: string, userId?: string | number): Promise<NotificationListResponse> => {
    const params = new URLSearchParams({ role });
    if (userId != null) params.set("user_id", String(userId));
    const res = await apiClient.get<NotificationListResponse>(`/notifications?${params.toString()}`);
    return res.data || { notifications: [], unread_count: 0 };
  },

  markRead: async (id: number): Promise<void> => {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  markAllRead: async (role: string, userId?: string | number): Promise<void> => {
    const params = new URLSearchParams({ role });
    if (userId != null) params.set("user_id", String(userId));
    await apiClient.patch(`/notifications/read-all?${params.toString()}`);
  },
};
