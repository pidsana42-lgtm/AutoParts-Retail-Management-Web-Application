import { createContext, useContext, useState, type ReactNode, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContexts';
import { notificationService } from '../service/http/notification_service';

export interface AppNotification {
  id: string;
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  eventType?: string;
  isRead: boolean;
  link?: string;
  createdAt: Date;
  // true = แจ้งเตือนนี้บันทึกอยู่ใน DB จริง (mark read ต้องยิง API ตาม) — false/undefined = แจ้งเตือนแบบเดิม (local เฉพาะ session นี้ ไม่บันทึก)
  persisted?: boolean;
}

interface NotificationContextProps {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (title: string, message?: string, type?: AppNotification['type']) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

function notificationSeverity(eventType?: string): AppNotification['type'] {
  const type = eventType?.toLowerCase();
  if (type === 'low_stock' || type === 'out_of_stock') return 'warning';
  if (type === 'success' || type === 'warning' || type === 'error') return type;
  return 'info';
}

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { role, user, loginSequence } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const localIdRef = useRef(0);
  const loginReminderRef = useRef<{ sequence: number; request: ReturnType<typeof notificationService.refreshStockAlerts> } | null>(null);

  useEffect(() => {
    if (!role) { setNotifications([]); return; }
    if (!loginSequence) return;
    const basePath = ['OWNER', 'MANAGER', 'ADMIN'].includes(role.toUpperCase()) ? '/owner' : '/employee';
    // Reuse the request during StrictMode's effect replay, but attach a live
    // subscriber each time. A new login always starts a new reminder check.
    if (loginReminderRef.current?.sequence !== loginSequence) {
      loginReminderRef.current = { sequence: loginSequence, request: notificationService.refreshStockAlerts() };
    }
    let active = true;
    loginReminderRef.current.request.then((alerts) => {
      if (!active || alerts.length === 0) return;
      const id = `local-stock-login-${loginSequence}`;
      setNotifications((prev) => [{
        id, title: `มีสินค้าถึงจุดแจ้งเตือนสต็อก ${alerts.length} รายการ`,
        message: 'กดเพื่อเลือกสินค้าและสร้างใบสั่งซื้อ', type: 'warning',
        eventType: 'LOW_STOCK', link: `${basePath}/dashboard?stock-alerts=1`,
        isRead: false, createdAt: new Date(), persisted: false,
      }, ...prev.filter((n) => n.id !== id)]);
    }).catch((err) => console.error('Failed to check stock on login:', err));
    return () => { active = false; };
  }, [role, loginSequence]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // แจ้งเตือนแบบ local ล้วนๆ (ของเดิม เช่น toast "สร้างใบเคลมสำเร็จ" หลังทำรายการของตัวเอง) — ไม่บันทึกลง DB ไม่ยิง API
  const addNotification = useCallback((title: string, message?: string, type: AppNotification['type'] = 'info') => {
    localIdRef.current -= 1;
    const newNotif: AppNotification = {
      id: `local-${localIdRef.current}`,
      title,
      message,
      type,
      isRead: false,
      createdAt: new Date(),
      persisted: false,
    };
    setNotifications(prev => [newNotif, ...prev]);
  }, []);

  // แจ้งเตือนที่มาจาก server (โหลดประวัติตอนเปิดหน้า หรือ push สดผ่าน websocket) — มี id จริงจาก DB
  const addServerNotification = useCallback((n: AppNotification) => {
    setNotifications(prev => {
      if (prev.some(existing => existing.id === n.id)) return prev; // กันซ้ำ (เผื่อ history โหลดมาก่อนที่ push สดจะมาถึง)
      return [n, ...prev];
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    const target = notifications.find(n => n.id === id);
    if (target?.persisted) {
      const numId = Number(id);
      if (!Number.isNaN(numId)) {
        notificationService.markRead(numId).catch(err => console.error('Failed to mark notification as read:', err));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    if (role) {
      notificationService.markAllRead(role, user?.id).catch(err => console.error('Failed to mark all as read:', err));
    }
  }, [role, user?.id]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // โหลดประวัติแจ้งเตือนจาก DB — ใช้ทั้งตอนล็อกอินเสร็จ/รีเฟรชหน้า และเรียกซ้ำเป็นระยะ (ดู polling ด้านล่าง)
  // เป็น safety net เผื่อ WebSocket หลุด/ยังไม่ทันต่อ connection ตอนที่มีแจ้งเตือนเกิดขึ้นพอดี (เช่น cron แจ้งสต็อกต่ำ
  // ที่รันเบื้องหลังโดยไม่รู้ว่าผู้ใช้เปิดหน้าเว็บอยู่ไหม) ไม่งั้นแจ้งเตือนนั้นจะหายไปเงียบๆ จนกว่าจะรีเฟรชหน้าเอง
  const fetchHistory = useCallback(() => {
    if (!role) return;
    return notificationService.list(role, user?.id)
      .then(res => {
        const visibleNotifications = role.toUpperCase() === 'OWNER'
          ? res.notifications
          : res.notifications.filter(r => r.type !== 'PO_PENDING_APPROVAL');
        const historyItems: AppNotification[] = visibleNotifications.map(r => ({
          id: String(r.id),
          title: r.title,
          message: r.message,
          type: notificationSeverity(r.type),
          eventType: r.type,
          isRead: r.is_read,
          link: r.link,
          createdAt: new Date(r.created_at),
          persisted: true,
        }));
        setNotifications(prev => {
          // เก็บแจ้งเตือน local (toast ของตัวเอง) ที่อาจเกิดขึ้นระหว่างรอโหลดไว้ด้วย ไม่ทับ
          const localOnly = prev.filter(n => !n.persisted);
          return [...historyItems, ...localOnly].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        });
      })
      .catch(err => console.error('Failed to load notification history:', err));
  }, [role, user?.id]);

  useEffect(() => {
    if (!role) return;
    let alive = true;
    if (alive) fetchHistory();

    // Polling สำรองทุก 45 วินาที — จับแจ้งเตือนที่ WebSocket พลาดไป (ดูคอมเมนต์ด้านบน)
    const pollInterval = setInterval(() => {
      if (alive) fetchHistory();
    }, 45000);

    return () => {
      alive = false;
      clearInterval(pollInterval);
    };
  }, [role, fetchHistory]);

  // ต่อ websocket รับแจ้งเตือนสด — ส่ง role/user_id ไปด้วยตอนเปิด connection เพื่อให้ backend รู้ว่าควรส่งอะไรมาให้ connection นี้บ้าง
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      let wsUrl = import.meta.env.VITE_WS_URL;
      if (!wsUrl) {
        if (typeof window !== 'undefined') {
          const { hostname, protocol } = window.location;
          const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${wsProtocol}//${hostname}:8080/ws`;
        } else {
          wsUrl = 'ws://localhost:8080/ws';
        }
      }
      const params = new URLSearchParams();
      if (role) params.set('role', role);
      if (user?.id != null) params.set('user_id', String(user.id));
      const query = params.toString();
      if (query) wsUrl += (wsUrl.includes('?') ? '&' : '?') + query;

      const socket = new WebSocket(wsUrl);
      ws = socket;

      // เพิ่งต่อ (หรือต่อกลับ) สำเร็จ — ดึงประวัติซ้ำทันที เผื่อพลาดแจ้งเตือนไปช่วงที่หลุดการเชื่อมต่อ
      socket.onopen = () => {
        fetchHistory();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.type === 'PO_PENDING_APPROVAL' && role?.toUpperCase() !== 'OWNER') return;
          if (data && data.title) {
            if (data.id) {
              // แจ้งเตือนที่ backend บันทึกลง DB แล้ว (เจาะจงเจ้าของร้าน/พนักงานคนใดคนหนึ่ง) — mark read ได้จริงผ่าน API
              addServerNotification({
                id: String(data.id),
                title: data.title,
                message: data.message,
                type: notificationSeverity(data.type),
                eventType: data.type,
                link: data.link,
                isRead: false,
                createdAt: new Date(),
                persisted: true,
              });
            } else {
              // แจ้งเตือนแบบเดิม (broadcast ทุกคน เช่น ใบเคลม/พรีออเดอร์ใหม่) — ไม่มี id จาก DB
              addNotification(data.title, data.message, data.type);
            }
          }
        } catch (err) {
          console.error('Failed to parse websocket message', err);
        }
      };

      socket.onerror = () => {
        if (disposed) return;
        console.warn('WebSocket error, attempting to reconnect...');
      };

      socket.onclose = () => {
        if (disposed) return;
        reconnectTimeout = setTimeout(connect, 1500);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimeout);
      if (!ws) return;

      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        // React StrictMode may unmount while the handshake is still in progress.
        // Wait until it opens before closing to avoid the browser's
        // "closed before the connection is established" warning.
        ws.onopen = () => ws.close();
      }
    };
  }, [role, user?.id, addNotification, addServerNotification, fetchHistory]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      addNotification,
      markAsRead,
      markAllAsRead,
      removeNotification,
      clearAll
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
