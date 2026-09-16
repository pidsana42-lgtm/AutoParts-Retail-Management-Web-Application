import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import StockAlertPOModal from '../../app/owner/dashboard/components/StockAlertPOModal';
import type { StockAlertItem } from '../../interface/dashboard/dashboard_interface';
import { notificationService } from '../../service/http/notification_service';

// Keep PO navigation within the signed-in user's existing role permissions.
export default function StockAlertNotificationModal({ onClose, basePath }: { onClose: () => void; basePath: '/owner' | '/manager' | '/employee' }) {
  const [alerts, setAlerts] = useState<StockAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    notificationService.refreshStockAlerts().then((data) => {
      if (active) setAlerts(data.filter((alert) => alert.is_resolved === 'false'));
    }).catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  if (!loading && !error && alerts.length > 0) {
    return <StockAlertPOModal isOpen onClose={onClose} stockAlerts={alerts} basePath={basePath} />;
  }
  return createPortal(
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div role='dialog' aria-modal='true' aria-labelledby='stock-notification-title' className='w-full max-w-lg bg-white p-6 shadow-xl'>
        <h2 id='stock-notification-title' className='text-lg font-semibold'>เลือกสินค้าเพื่อสร้างใบสั่งซื้อ</h2>
        <p role={error ? 'alert' : 'status'} className='my-4'>
          {loading ? 'กำลังตรวจสอบสต็อกล่าสุด…' : error ? 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่' : 'ไม่มีสินค้าถึงจุดแจ้งเตือนแล้ว ไม่จำเป็นต้องสร้างใบสั่งซื้อ'}
        </p>
        {error && <button type='button' className='mr-4' onClick={() => setAttempt((value) => value + 1)}>ลองใหม่</button>}
        <button type='button' onClick={onClose}>ปิด</button>
      </div>
    </div>, document.body,
  );
}
