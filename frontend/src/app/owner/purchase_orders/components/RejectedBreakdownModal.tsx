import React from "react";
import { X, AlertCircle } from "lucide-react";
import Heading from "../../../../components/elements/heading";
import type { SupplierRejectedSummary } from "../../../../interface/purchase_orders/po_interface";

interface RejectedBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SupplierRejectedSummary[];
}

export const RejectedBreakdownModal: React.FC<RejectedBreakdownModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen) return null;

  const total = data.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden bg-white shadow-xl border border-gray-200">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <Heading level="h4" className="font-semibold text-gray-900">
              ยอดรอส่งอนุมัติใหม่ทั้งหมด ({data.length} รายการ)
            </Heading>

            <div className="flex items-center gap-2 mt-2">
              <AlertCircle size={15} className="text-red-500" />
              <Heading level="p" className="text-sm text-red-600">
                ใบสั่งซื้อที่ถูกตีกลับจะมีอายุ 7 วัน
              </Heading>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-none text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto p-4">
          {data.length > 0 ? (
            <>
              <div className="space-y-2">
                {data.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md px-3 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <span className="max-w-60 truncate text-sm font-medium text-gray-700">
                      {item.supplier_name || "ไม่ระบุชื่อบริษัท"}
                    </span>

                    <span className="tabular-nums text-sm font-semibold text-gray-900">
                      ฿
                      {Number(item.amount).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t pt-4 flex items-center justify-between">
                <span className="font-medium text-gray-700">
                  รวมทั้งหมด
                </span>

                <span className="tabular-nums text-lg font-bold text-red-600">
                  ฿
                  {total.toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">
              ไม่มีข้อมูลการไม่อนุมัติในเดือนนี้
            </p>
          )}
        </div>
      </div>
    </div>
  );
};