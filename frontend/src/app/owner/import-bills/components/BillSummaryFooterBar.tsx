import React from 'react';

interface BillSummaryFooterBarProps {
  totalItems: number;
  subtotal: number;
  totalAmount: number;
  onCancel: () => void;
  cancelText?: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export default function BillSummaryFooterBar({
  totalItems,
  subtotal,
  totalAmount,
  onCancel,
  cancelText = 'ยกเลิก',
  disabled = false,
  className = '',
  children,
}: BillSummaryFooterBarProps) {
  return (
    <div className={`border-t border-gray-100 p-6 flex justify-between items-end bg-[#fafafa] rounded-none mt-6 ${className}`}>
      <div className="text-sm text-[#5F5E5E] space-y-2 text-left">
        <p>
          จำนวนรายการทั้งหมด :{' '}
          <span className="text-[#1C1B1B] font-bold">{totalItems} รายการ</span>
        </p>
        <p>
          มูลค่าสินค้า :{' '}
          <span className="text-[#1C1B1B] font-bold">
            ฿{subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </span>
        </p>
      </div>
      <div className="text-right flex items-end gap-4">
        <div>
          <p className="text-sm text-[#e51c23] font-bold mb-1 text-left">ยอดเงินสุทธิรวม:</p>
          <p className="text-xl text-[#e51c23] font-bold">
            {totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 px-5 py-3 rounded-none text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          {cancelText}
        </button>
        {children}
      </div>
    </div>
  );
}
