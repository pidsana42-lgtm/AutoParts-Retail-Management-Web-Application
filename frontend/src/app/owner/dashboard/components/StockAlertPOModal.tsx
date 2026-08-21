import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageSearch, ShoppingCart } from 'lucide-react';
import Modal from '../../../../components/elements/modal';
import Button from '../../../../components/elements/button';
import { cn } from '../../../../utils/component';
import type { StockAlertItem } from '../../../../interface/dashboard/dashboard_interface';
import type { LocalPOItem } from '../../../../interface/purchase_orders/po_interface';
import { generateLocalId } from '../../../../utils/generateId';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stockAlerts: StockAlertItem[];
  basePath: string;
}

interface SupplierGroup {
  supplierId: number | null;
  supplierName: string;
  items: StockAlertItem[];
}

export default function StockAlertPOModal({ isOpen, onClose, stockAlerts, basePath }: Props) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState(0);

  const groups = useMemo<SupplierGroup[]>(() => {
    const map = new Map<string, SupplierGroup>();
    stockAlerts.forEach((alert) => {
      const key = alert.supplier_id != null ? String(alert.supplier_id) : 'none';
      if (!map.has(key)) {
        map.set(key, {
          supplierId: alert.supplier_id ?? null,
          supplierName: alert.supplier_name || 'ไม่ระบุซัพพลายเออร์',
          items: [],
        });
      }
      map.get(key)!.items.push(alert);
    });
    return Array.from(map.values());
  }, [stockAlerts]);

  const toggle = (id: number) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleAll = (items: StockAlertItem[]) => {
    const allChecked = items.every((a) => selected[a.id]);
    setSelected((prev) => {
      const next = { ...prev };
      items.forEach((a) => { next[a.id] = !allChecked; });
      return next;
    });
  };

  const selectedInGroup = (items: StockAlertItem[]) =>
    items.filter((a) => selected[a.id]);

  const handleProceed = (group: SupplierGroup) => {
    const chosenAlerts = selectedInGroup(group.items);
    if (chosenAlerts.length === 0) return;

    const preselectedItems: LocalPOItem[] = chosenAlerts.map((alert) => {
      const qty = Math.max(1, (alert.limit_quantity ?? 0) - (alert.quantity_at_alert ?? 0));
      const unitPrice = alert.cost_price ?? 0;
      return {
        id: generateLocalId(),
        product_id: alert.product_id ?? 0,
        product_name_snapshot: alert.product_name ?? '',
        product_name_code_snapshot: alert.product_code ?? '-',
        quantity: qty,
        unit: alert.unit_name || 'ชิ้น',
        unit_price: unitPrice,
        sub_total: qty * unitPrice,
        order_type: 'สั่งซื้อ' as const,
        alert_id: alert.id,
      };
    });

    navigate(`${basePath}/new-orders`, {
      state: {
        supplierId: group.supplierId != null ? String(group.supplierId) : '',
        supplierName: group.supplierName,
        preselectedItems,
      },
    });
    onClose();
  };

  if (groups.length === 0) return null;
  const currentGroup = groups[activeTab] ?? groups[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size='xl'
      title='เลือกสินค้าเพื่อสร้างใบสั่งซื้อ'
      description='สินค้าถูกจัดกลุ่มตามซัพพลายเออร์ เลือกรายการที่ต้องการสั่งซื้อจากแต่ละซัพพลายเออร์'
    >
      {/* Supplier Tabs */}
      <div className='flex gap-0 border-b border-gray-200 mb-4 overflow-x-auto'>
        {groups.map((g, idx) => {
          const cnt = selectedInGroup(g.items).length;
          return (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                activeTab === idx
                  ? 'border-[#d61c24] text-[#d61c24]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {g.supplierName}
              {cnt > 0 && (
                <span className='ml-1.5 bg-[#d61c24] text-white text-xs rounded-full px-1.5 py-0.5'>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Item List */}
      <div className='space-y-2'>
        {/* Select All row */}
        <label className='flex items-center gap-2 px-3 py-2 bg-transparent rounded-none cursor-pointer text-sm text-gray-600 font-medium'>
          <input
            type='checkbox'
            className='accent-[#d61c24] w-4 h-4'
            checked={currentGroup.items.length > 0 && currentGroup.items.every((a) => selected[a.id])}
            onChange={() => toggleAll(currentGroup.items)}
          />
          เลือกทั้งหมด ({currentGroup.items.length} รายการ)
        </label>

        {currentGroup.items.map((alert) => {
          return (
            <label
              key={alert.id}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-none border cursor-pointer transition-colors',
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
                <div className='text-sm font-medium text-gray-800 truncate'>{alert.product_name}</div>
                <div className='text-xs text-gray-400'>SKU: {alert.product_code}</div>
              </div>
              <div className='text-right shrink-0'>
                <div className='text-xs text-gray-400'>คงเหลือ / ขั้นต่ำ</div>
                <div className='text-sm'>
                  <span className='text-red-600 font-semibold'>{alert.quantity_at_alert}</span>
                  <span className='text-gray-400'> / {alert.limit_quantity}</span>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Footer */}
      <div className='mt-5 flex items-center justify-between'>
        <span className='text-sm text-gray-500'>
          เลือก {selectedInGroup(currentGroup.items).length} จาก {currentGroup.items.length} รายการ
        </span>
        <div className='flex gap-2'>
          <Button variant='secondary' size='sm' onClick={onClose}>ยกเลิก</Button>
          <Button
            variant='primary'
            size='sm'
            className='text-white rounded-none'
            disabled={selectedInGroup(currentGroup.items).length === 0}
            onClick={() => handleProceed(currentGroup)}
          >
            <ShoppingCart size={15} />
            สร้างใบสั่งซื้อ — {currentGroup.supplierName}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
