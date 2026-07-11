import React from "react";
import { X } from "lucide-react";
import type { SupplierRejectedSummary } from "../../../../interface/purchase_orders/po_interface";

// กำหนด Type ให้กับ Props ที่ Component นี้ต้องรับเข้ามา
interface RejectedBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SupplierRejectedSummary[];
}

export const RejectedBreakdownModal: React.FC<RejectedBreakdownModalProps> = ({ 
  isOpen, 
  onClose, 
  data 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-base font-semibold text-gray-800">ยอดไม่อนุมัติแยกตามบริษัท (MTD)</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 p-1 rounded-none hover:bg-gray-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-87.5 overflow-y-auto space-y-1 divide-y divide-gray-100">
          {data.length > 0 ? (
            data.map((item, index) => (
              <div key={index} className="flex justify-between items-center py-3 first:pt-0 last:pb-0">
                <span className="font-medium text-gray-700 text-sm truncate max-w-60">
                  {item.supplier_name || "ไม่ระบุชื่อบริษัท"}
                </span>
                <span className="font-semibold text-gray-950 text-sm">
                  ฿{Number(item.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-gray-400 py-6">ไม่มีข้อมูลการไม่อนุมัติในเดือนนี้</p>
          )}
        </div>
      </div>
    </div>
  );
};