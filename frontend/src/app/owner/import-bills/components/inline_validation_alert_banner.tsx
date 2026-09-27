import { useNavigate } from 'react-router-dom';
import { AlertCircle, Edit3, FileText, X } from 'lucide-react';
import type { PriceMismatchItem } from './price_update_modal';
import { usePathBasePrefix } from '../../../../utils/usePathBasePrefix';

interface InlineValidationAlertBannerProps {
  warnings?: string[];
  mismatchedItems?: PriceMismatchItem[];
  onDismiss?: () => void;
  isDraftMode?: boolean;
  isEmployee?: boolean;
}

export default function InlineValidationAlertBanner({
  warnings = [],
  mismatchedItems = [],
  onDismiss,
  isDraftMode = false,
  isEmployee = false,
}: InlineValidationAlertBannerProps) {
  const navigate = useNavigate();
  const basePath = usePathBasePrefix();

  const hasWarnings = warnings.length > 0;
  const hasMismatches = mismatchedItems.length > 0;

  if (!hasWarnings && !hasMismatches) return null;

  const handleOpenEditStockBill = () => {
    if (hasMismatches) {
      try {
        sessionStorage.setItem('temp_import_bill_items', JSON.stringify(mismatchedItems));
      } catch (e) {
        console.error(e);
      }
    }
    navigate(`${basePath}/import-bills/edit-stock-bill`, {
      state: { mismatchedItems, isFromImportBill: true }
    });
  };

  const getSubTitle = () => {
    if (isDraftMode) {
      return 'คุณยืนยันจะบันทึกข้อมูลบิลนี้เป็นแบบร่างใช่หรือไม่? ท่านสามารถกลับมาตรวจสอบและแก้ไขข้อมูลเพิ่มเติมได้ในภายหลัง';
    }
    if (isEmployee) {
      return 'พบส่วนต่างราคาทุนสินค้าและข้อสังเกตข้อมูลบิล ข้อมูลส่วนต่างนี้จะถูกบันทึกและส่งให้เจ้าของร้าน (Owner) ตรวจสอบและอนุมัติราคาทุนใหม่';
    }
    return 'พบข้อสังเกตและราคานำเข้าใหม่ในบิลไม่ตรงกับราคาทุนในคลังสินค้า กรุณาตรวจสอบและกดยืนยันที่ปุ่มด้านล่าง';
  };

  return (
    <div className="mb-6 p-5 bg-red-50/90 border border-red-300 rounded-none shadow-sm animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-red-200 pb-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-100 border border-red-200 text-[#e51c23] shrink-0 mt-0.5">
            {isDraftMode ? <FileText className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-[#1C1B1B]">
              {isDraftMode
                ? 'ยืนยันการบันทึกเอกสารเป็นแบบร่าง (Draft Confirmation)'
                : 'แจ้งเตือนการตรวจสอบข้อมูลบิล (Validation & Price Mismatches)'}
            </h4>
            <p className="text-xs text-red-800 font-medium mt-0.5">{getSubTitle()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasMismatches && !isEmployee && !isDraftMode && (
            <button
              type="button"
              onClick={handleOpenEditStockBill}
              className="px-3.5 py-1.5 bg-[#1C1B1B] hover:bg-gray-800 text-white font-bold text-xs rounded-none transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#e51c23]" />
              <span>จัดการรายสินค้า ({mismatchedItems.length})</span>
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-red-100 rounded-none transition-colors cursor-pointer"
              title="ปิด"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Price Mismatches Table */}
      {hasMismatches && (
        <div className="bg-white border border-red-200 overflow-x-auto mb-3">
          <div className="bg-red-100/80 px-3 py-1.5 border-b border-red-200 text-xs font-bold text-[#1C1B1B]">
            ตรวจพบราคานำเข้าใหม่ไม่ตรงกับราคาทุนในคลัง ({mismatchedItems.length} รายการ):
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-red-50 text-[#1C1B1B] font-bold border-b border-red-200">
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
      )}

      {/* Validation Warnings */}
      {hasWarnings && (
        <div className="bg-white border border-red-200 p-3 overflow-x-auto">
          <div className="text-xs font-bold text-[#1C1B1B] mb-2">ข้อสังเกตข้อมูลบิล:</div>
          <ul className="space-y-1.5">
            {warnings.map((w, idx) => (
              <li key={idx} className="text-xs text-[#1C1B1B] font-semibold flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#e51c23] rounded-none inline-block shrink-0" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
