import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export interface PriceMismatchItem {
  index: number;
  productId: number;
  productCode: string;
  productName: string;
  companyProductName: string;
  dbPrice: number;
  billPrice: number;
}

interface PriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  mismatchedItems: PriceMismatchItem[];
  onConfirm: (selectedProductIdsToUpdate: number[]) => void;
}

export default function PriceUpdateModal({
  isOpen,
  onClose,
  mismatchedItems,
  onConfirm
}: PriceUpdateModalProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Checked by default
      setSelectedIds(mismatchedItems.map(item => item.productId));
    }
  }, [isOpen, mismatchedItems]);

  if (!isOpen) return null;

  const handleToggle = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    if (selectedIds.length === mismatchedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(mismatchedItems.map(item => item.productId));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-none shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-300">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center gap-3 text-red-800">
          <AlertCircle className="w-6 h-6 shrink-0 text-[#e51c23]" />
          <div>
            <h3 className="font-bold text-lg text-[#1C1B1B]">ตรวจพบราคาสินค้าไม่ตรงกับฐานข้อมูลคลัง</h3>
            <p className="text-xs text-red-700 font-medium">กรุณาเลือกรายการที่ต้องการอัปเดตราคาทุนในระบบหลังบ้าน</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <p className="text-sm text-[#5F5E5E] leading-relaxed">
            รายการสินค้าต่อไปนี้มีราคานำเข้าในบิลไม่ตรงกับราคาทุนปัจจุบันในฐานข้อมูลคลังสินค้า ท่านต้องการอัปเดตราคาทุนของสินค้าเหล่านี้ให้ตรงตามบิลนี้ด้วยหรือไม่?
          </p>

          <div className="border border-gray-200 rounded-none overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-150 border-b border-gray-200 text-[#1c1b1b] font-bold">
                  <th className="p-3 w-12 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length === mismatchedItems.length && mismatchedItems.length > 0}
                      onChange={handleToggleAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="p-3">สินค้า</th>
                  <th className="p-3 text-right">ราคาทุนในคลัง</th>
                  <th className="p-3 text-right">ราคานำเข้าใหม่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mismatchedItems.map((item) => {
                  const isChecked = selectedIds.includes(item.productId);
                  return (
                    <tr key={`${item.productId}-${item.index}`} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => handleToggle(item.productId)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#1C1B1B]">{item.productName}</div>
                        <div className="text-[10px] text-gray-500 font-medium">
                          รหัสระบบ: {item.productCode} | ชื่อในบิล: {item.companyProductName}
                        </div>
                      </td>
                      <td className="p-3 text-right text-[#5F5E5E] font-medium">
                        ฿{item.dbPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right text-[#e51c23] font-bold">
                        ฿{item.billPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-none hover:bg-gray-105 cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedIds)}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#e51c23] hover:bg-[#c9181f] rounded-none cursor-pointer"
          >
            ยืนยันนำเข้าและอัปเดตราคา
          </button>
        </div>
      </div>
    </div>
  );
}
