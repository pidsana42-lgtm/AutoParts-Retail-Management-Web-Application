import { useNavigate } from 'react-router-dom';
import { AlertCircle, Edit3, CheckCircle2 } from 'lucide-react';
import type { PriceMismatchItem } from './price_update_modal';
import { usePathBasePrefix } from '../../../../utils/usePathBasePrefix';

interface InlinePriceAlertBannerProps {
  mismatchedItems: PriceMismatchItem[];
  onConfirmUpdatePrices: () => void;
  onSkipPriceUpdate: () => void;
  saving?: boolean;
}

export default function InlinePriceAlertBanner({
  mismatchedItems,
  onConfirmUpdatePrices,
  onSkipPriceUpdate,
  saving = false
}: InlinePriceAlertBannerProps) {
  const navigate = useNavigate();
  const basePath = usePathBasePrefix();

  if (!mismatchedItems || mismatchedItems.length === 0) return null;

  const handleGoToEditStockBill = () => {
    try {
      sessionStorage.setItem('temp_import_bill_items', JSON.stringify(mismatchedItems));
    } catch (e) {
      console.error('Failed to set sessionStorage:', e);
    }
    navigate(`${basePath}/import-bills/edit-stock-bill`, {
      state: { mismatchedItems, isFromImportBill: true }
    });
  };

  return (
    <div className="mb-6 p-5 bg-red-50/90 border border-red-300 rounded-none shadow-sm animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-red-200 pb-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-100 border border-red-200 text-[#e51c23] shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-[#1C1B1B]">
              ตรวจพบราคานำเข้าใหม่ในบิลไม่ตรงกับราคาทุนในคลังสินค้า ({mismatchedItems.length} รายการ)
            </h4>
            <p className="text-xs text-red-800 font-medium mt-0.5">
              ท่านสามารถเลือกย้อนกลับไปแก้ไข ไปยังหน้าจัดการสินค้าเพื่อแก้ไขรายรายการ หรืออัปเดตราคาทุนตามบิลนี้เข้าสู่ระบบ
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoToEditStockBill}
          className="px-4 py-2 bg-[#1C1B1B] hover:bg-gray-800 text-white font-bold text-xs rounded-none transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
        >
          <Edit3 className="w-4 h-4 text-[#e51c23]" />
          <span>ไปยังหน้าจัดการสินค้า (แก้ไขรายสินค้า)</span>
        </button>
      </div>

      {/* Mismatched Items Table Preview */}
      <div className="bg-white border border-red-200 mb-4 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-red-100/60 text-[#1C1B1B] font-bold border-b border-red-200">
              <th className="p-2.5">รายการสินค้าในบิล</th>
              <th className="p-2.5 text-right">ราคาทุนเดิมใน DB</th>
              <th className="p-2.5 text-right text-[#e51c23] font-bold">ราคานำเข้าใหม่ (บิล)</th>
              <th className="p-2.5 text-right">ส่วนต่างราคาทุน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-100">
            {mismatchedItems.map((item) => {
              const diff = item.billPrice - item.dbPrice;
              return (
                <tr key={item.productId} className="hover:bg-red-50/50">
                  <td className="p-2.5">
                    <div className="font-bold text-[#1C1B1B]">{item.productName}</div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      CODE: {item.productCode} | ชื่อในบิล: {item.companyProductName}
                    </div>
                  </td>
                  <td className="p-2.5 text-right font-medium text-gray-600">
                    ฿{item.dbPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 text-right font-bold text-[#e51c23]">
                    ฿{item.billPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 text-right font-bold">
                    <span className={diff > 0 ? 'text-[#e51c23]' : 'text-emerald-700'}>
                      {diff > 0 ? '+' : ''}฿{diff.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={onSkipPriceUpdate}
          disabled={saving}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold text-xs rounded-none transition-colors cursor-pointer"
        >
          บันทึกบิลโดยไม่อัปเดตราคาทุน (คงราคาทุนเดิม)
        </button>

        <button
          type="button"
          onClick={onConfirmUpdatePrices}
          disabled={saving}
          className="px-6 py-2 bg-[#e51c23] hover:bg-[#c9181f] text-white font-bold text-xs rounded-none transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>ยืนยันอัปเดตราคาทุนตามบิลและบันทึกบิล ({mismatchedItems.length} รายการ)</span>
        </button>
      </div>
    </div>
  );
}
