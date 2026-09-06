import React, { useState } from "react";
import { Link } from "react-router-dom";
import { X, AlertCircle, Building2, ChevronDown, FileText } from "lucide-react";
import Heading from "../../../../components/elements/heading";
import type { SupplierRejectedSummary } from "../../../../interface/purchase_orders/po_interface";
import { formatDateThai } from "../../../../utils/formatdate";

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
  const [expandedSupplierId, setExpandedSupplierId] = useState<number | null>(null);

  if (!isOpen) return null;

  const total = data.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl overflow-hidden bg-white shadow-xl border border-gray-200">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <Heading level="h4" className="font-semibold text-gray-900">
              ยอดรอส่งอนุมัติใหม่แยกตามบริษัท ({data.length} บริษัท)
            </Heading>

            <div className="flex items-center gap-2 mt-2">
              <AlertCircle size={15} className="text-red-500" />
              <Heading level="p" className="text-sm text-red-600">
                ระบบจะทำการแจ้งเตือนใบสั่งซื้อที่ถูกตีกลับและไม่มีการแก้ไขเป็นเวลา 7 วัน
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
                {data.map((item, index) => {
                  const supplierKey = item.supplier_id || -(index + 1);
                  const isExpanded = expandedSupplierId === supplierKey;
                  const purchaseOrders = item.purchase_orders ?? [];
                  const poCount = item.po_count ?? purchaseOrders.length;

                  return (
                    <div key={supplierKey} className="overflow-hidden border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setExpandedSupplierId(isExpanded ? null : supplierKey)}
                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                        aria-expanded={isExpanded}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Building2 size={18} className="shrink-0 text-gray-500" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-800">
                              {item.supplier_name || "ไม่ระบุชื่อบริษัท"}
                            </div>
                            <div className="mt-0.5 text-xs text-gray-500">{poCount} ใบสั่งซื้อ</div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <span className="tabular-nums text-sm font-semibold text-gray-900">
                            ฿{Number(item.amount).toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <ChevronDown
                            size={17}
                            className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-200 bg-gray-50/70 px-4 py-2">
                          {purchaseOrders.length > 0 ? (
                            <div className="divide-y divide-gray-200">
                              {purchaseOrders.map((po) => (
                                <Link
                                  key={po.id}
                                  to={`/owner/orders/${po.id}`}
                                  onClick={onClose}
                                  className="flex items-center justify-between gap-4 py-2.5 text-sm hover:text-red-600"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <FileText size={15} className="shrink-0 text-gray-400" />
                                    <div>
                                      <div className="font-medium">{po.po_number}</div>
                                      <div className="text-xs text-gray-500">แก้ไขล่าสุด {formatDateThai(po.updated_at)}</div>
                                    </div>
                                  </div>
                                  <span className="shrink-0 tabular-nums font-medium">
                                    ฿{Number(po.total_amount).toLocaleString("th-TH", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <p className="py-3 text-center text-xs text-gray-400">ไม่พบรายละเอียดใบสั่งซื้อ</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
              ไม่มีข้อมูลการตีกลับใบสั่งซื้อในตอนนี้
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
