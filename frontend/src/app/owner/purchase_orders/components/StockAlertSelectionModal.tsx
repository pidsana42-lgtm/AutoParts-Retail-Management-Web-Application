import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PackageSearch, X, PackagePlus } from 'lucide-react';
import Button from '../../../../components/elements/button';
import { cn } from '../../../../utils/component';
import type { StockAlertItem } from '../../../../interface/dashboard/dashboard_interface';
import type { LocalPOItem } from '../../../../interface/purchase_orders/po_interface';
import { generateLocalId } from '../../../../utils/generateId';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stockAlerts: StockAlertItem[];
  existingItems: LocalPOItem[];
  onAddItems: (items: LocalPOItem[]) => void;
}

export default function StockAlertSelectionModal({
  isOpen,
  onClose,
  stockAlerts,
  existingItems,
  onAddItems,
}: Props) {
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  // รีเซ็ตการเลือกเมื่อเปิด Modal ใหม่
  useEffect(() => {
    if (isOpen) setSelected({});
  }, [isOpen]);

  // ปิด modal ด้วย Esc และล็อกการ scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // กรองเฉพาะสินค้าที่ยังไม่มีใบสั่งซื้อ (PO)
  const nonPoAlerts = useMemo(
    () => stockAlerts.filter((a) => !a.has_po && !a.po_id && !a.po_number),
    [stockAlerts]
  );

  // เช็คว่ามีอยู่ในตะกร้าแล้วหรือไม่ (จาก alert_id)
  const addedAlertIds = useMemo(
    () => new Set(existingItems.filter((i) => i.alert_id).map((i) => i.alert_id!)),
    [existingItems]
  );

  // กรองเฉพาะที่ยังไม่ได้เพิ่มในตะกร้า
  const availableAlerts = useMemo(
    () => nonPoAlerts.filter((a) => !addedAlertIds.has(a.id)),
    [nonPoAlerts, addedAlertIds]
  );

  const alreadyAddedAlerts = useMemo(
    () => nonPoAlerts.filter((a) => addedAlertIds.has(a.id)),
    [nonPoAlerts, addedAlertIds]
  );

  const toggle = (id: number) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleAll = () => {
    const allChecked = availableAlerts.every((a) => selected[a.id]);
    setSelected((prev) => {
      const next = { ...prev };
      availableAlerts.forEach((a) => {
        next[a.id] = !allChecked;
      });
      return next;
    });
  };

  const selectedCount = availableAlerts.filter((a) => selected[a.id]).length;

  const handleProceed = () => {
    const chosenAlerts = availableAlerts.filter((a) => selected[a.id]);
    if (chosenAlerts.length === 0) return;

    const newItems: LocalPOItem[] = chosenAlerts.map((alert) => {
      const qty = Math.max(1, (alert.limit_quantity ?? 0) - (alert.quantity_at_alert ?? 0));
      const unitPrice = alert.cost_price ?? 0;
      return {
        id: generateLocalId(),
        product_id: alert.product_id ?? 0,
        product_name_snapshot: alert.product_name ?? '',
        product_code_snapshot: alert.product_code ?? '-',
        supply_product_code_snapshot: alert.supply_product_code ?? '',
        quantity: qty,
        unit: alert.unit_name || 'ชิ้น',
        unit_price: unitPrice,
        sub_total: qty * unitPrice,
        order_type: 'สั่งซื้อ' as const,
        alert_id: alert.id,
      };
    });

    onAddItems(newItems);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-2 sm:p-4'
      role='dialog'
      aria-modal='true'
      aria-labelledby='stock-alert-selection-title'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className='flex max-h-[95vh] w-full max-w-2xl animate-in flex-col rounded-none bg-white shadow-2xl fade-in zoom-in-95 duration-150 sm:max-h-[85vh]'>
        {/* Header */}
        <div className='flex items-start justify-between gap-3 border-b border-gray-100 px-4 pb-3 pt-4 sm:gap-4 sm:px-6 sm:pb-4 sm:pt-6'>
          <div>
            <h2
              id='stock-alert-selection-title'
              className='text-lg font-bold text-slate-800'
            >
              สินค้าใกล้หมดสต็อก
            </h2>
            <p className='mt-1 text-sm text-slate-500'>
              เลือกรายการสินค้าที่ต้องการเพิ่มลงในใบสั่งซื้อ
            </p>
          </div>
          <button
            type='button'
            aria-label='ปิด'
            onClick={onClose}
            className='shrink-0 text-gray-400 hover:text-gray-600 cursor-pointer'
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto px-3 pt-3 sm:px-6 sm:pt-4'>
          {nonPoAlerts.length === 0 ? (
            <div className='flex flex-col items-center justify-center gap-3 py-12 text-gray-400'>
              <PackageSearch size={48} className='text-gray-200' />
              <p className='text-sm'>ไม่มีสินค้าใกล้หมดสต็อกจากซัพพลายเออร์นี้</p>
            </div>
          ) : (
            <div className='space-y-2 pb-4'>
              {/* Select All (เฉพาะที่ยังไม่ได้เพิ่ม) */}
              {availableAlerts.length > 0 && (
                <label className='flex items-center gap-2 px-3 py-2 bg-transparent rounded-none cursor-pointer text-sm text-gray-600 font-medium'>
                  <input
                    type='checkbox'
                    className='accent-[#d61c24] w-4 h-4'
                    checked={
                      availableAlerts.length > 0 &&
                      availableAlerts.every((a) => selected[a.id])
                    }
                    onChange={toggleAll}
                  />
                  เลือกทั้งหมด ({availableAlerts.length} รายการ)
                </label>
              )}

              {/* Available items */}
              {availableAlerts.map((alert) => {
                const suggestedQty = Math.max(
                  1,
                  (alert.limit_quantity ?? 0) - (alert.quantity_at_alert ?? 0)
                );
                return (
                  <label
                    key={alert.id}
                    className={cn(
                      'flex flex-wrap items-center gap-3 rounded-none border px-3 py-3 cursor-pointer transition-colors sm:flex-nowrap',
                      selected[alert.id]
                        ? 'border-[#d61c24] bg-red-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    )}
                  >
                    <input
                      type='checkbox'
                      className='accent-[#d61c24] w-4 h-4 shrink-0'
                      checked={!!selected[alert.id]}
                      onChange={() => toggle(alert.id)}
                    />
                    <PackageSearch size={16} className='text-gray-400 shrink-0' />
                    <div className='flex-1 min-w-0'>
                      <span className='text-sm font-medium text-gray-800 truncate'>
                        {alert.product_name}
                      </span>
                      <div className='flex items-center gap-3 text-xs text-gray-400 mt-0.5'>
                        <span>SKU: {alert.product_code}</span>
                        <span>
                          จะสั่ง{' '}
                          <strong className='text-gray-700'>{suggestedQty}</strong>{' '}
                          {alert.unit_name || 'ชิ้น'}
                        </span>
                      </div>
                    </div>
                    <div className='ml-auto shrink-0 text-right'>
                      <div className='text-xs text-gray-400'>คงเหลือ / ขั้นต่ำ</div>
                      <div className='text-sm'>
                        <span className='font-semibold text-red-600'>
                          {alert.quantity_at_alert}
                        </span>
                        <span className='text-gray-400'>
                          {' '}
                          / {alert.limit_quantity}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}

              {/* Already added items */}
              {alreadyAddedAlerts.length > 0 && (
                <>
                  <div className='text-xs text-gray-400 font-medium px-3 pt-3'>
                    เพิ่มในใบสั่งซื้อแล้ว ({alreadyAddedAlerts.length} รายการ)
                  </div>
                  {alreadyAddedAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className='flex flex-wrap items-center gap-3 rounded-none border border-green-200 bg-green-50/50 px-3 py-3 sm:flex-nowrap opacity-60'
                    >
                      <div className='w-4 h-4 shrink-0 flex items-center justify-center text-green-600 text-xs font-bold'>
                        ✓
                      </div>
                      <PackageSearch size={16} className='text-green-400 shrink-0' />
                      <div className='flex-1 min-w-0'>
                        <span className='text-sm font-medium text-gray-600 truncate'>
                          {alert.product_name}
                        </span>
                        <div className='text-xs text-gray-400 mt-0.5'>
                          SKU: {alert.product_code}
                        </div>
                      </div>
                      <span className='text-xs text-green-600 font-medium shrink-0'>
                        เพิ่มแล้ว
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='flex flex-col gap-3 border-t border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
          <span className='text-sm text-gray-500'>
            เลือก {selectedCount} จาก {availableAlerts.length} รายการ
          </span>
          <div className='flex w-full gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none'>
            <Button variant='secondary' size='sm' onClick={onClose}>
              ยกเลิก
            </Button>
            <Button
              variant='primary'
              size='sm'
              className='text-white rounded-none'
              disabled={selectedCount === 0}
              onClick={handleProceed}
            >
              <PackagePlus size={15} />
              เพิ่ม {selectedCount > 0 ? `${selectedCount} รายการ` : 'ลงใบสั่งซื้อ'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
