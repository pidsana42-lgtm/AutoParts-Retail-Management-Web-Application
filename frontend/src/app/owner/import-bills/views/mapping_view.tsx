import { ChevronLeft, ChevronRight, Table2, CheckCircle2, AlertCircle } from 'lucide-react';
import Heading from '../../../../components/elements/heading';
import type { ViewState, ExcelImportPreview, ColumnMapping } from '../../../../interface/import';

interface MappingViewProps {
  setCurrentView: (view: ViewState) => void;
  preview: ExcelImportPreview | null;
  mapping: ColumnMapping | null;
  onMappingChange: (mapping: ColumnMapping) => void;
  onConfirm: () => void;
}

const FIELDS: { key: keyof ColumnMapping; label: string; required: boolean; hint?: string }[] = [
  { key: 'code', label: 'รหัสสินค้าคู่ค้า', required: true, hint: 'รหัส / Part Number' },
  { key: 'name', label: 'ชื่อสินค้าตามบิล', required: true, hint: 'ชื่อสินค้า / รายการ' },
  { key: 'quantity', label: 'จำนวนที่สั่ง', required: true },
  { key: 'price', label: 'ราคาต่อหน่วย', required: true },
  { key: 'unit', label: 'หน่วย', required: false, hint: 'เว้นว่าง = "ชิ้น"' },
];

export default function MappingView({ setCurrentView, preview, mapping, onMappingChange, onConfirm }: MappingViewProps) {
  if (!preview || !mapping) return null;

  const colIndexOf = (field: keyof ColumnMapping): number => {
    const header = mapping[field];
    return header ? preview.headers.indexOf(header) : -1;
  };

  const missingRequired = FIELDS.filter((f) => f.required && !mapping[f.key]);
  const canConfirm = missingRequired.length === 0 && preview.rows.length > 0;

  const getCellValue = (rowIdx: number, field: keyof ColumnMapping): string => {
    const colIdx = colIndexOf(field);
    if (colIdx < 0) return '';
    const val = preview.rows[rowIdx]?.[colIdx];
    if (val === null || val === undefined) return '';
    return String(val).trim();
  };

  const previewRows = preview.rows.slice(0, 8);

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <button type="button" onClick={() => setCurrentView('excel')} className="hover:text-[#e51c23] transition-colors cursor-pointer font-bold">
          นำเข้าด้วยไฟล์ CSV / Excel
        </button>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-[#1C1B1B] font-bold">จับคู่คอลัมน์</span>
      </nav>

      {/* Header */}
      <div className="mb-2">
        <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
          ตรวจสอบการจับคู่คอลัมน์
        </Heading>
      </div>
      <p className="text-sm text-[#5F5E5E] mb-6">
        ไฟล์ <span className="font-bold text-[#1C1B1B]">{preview.fileName}</span> · แผ่นงาน{' '}
        <span className="font-bold text-[#1C1B1B]">{preview.activeSheet}</span> · พบ {preview.rows.length.toLocaleString()} รายการ
        — ระบบจับคู่คอลัมน์ให้อัตโนมัติแล้ว กรุณาตรวจสอบว่าถูกต้องก่อนดำเนินการต่อ
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Column Mapping Card */}
        <div className="bg-white rounded-none shadow-sm border border-gray-100 p-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-5">
            <Table2 size={18} className="text-[#e51c23]" />
            <h3 className="font-bold text-[#1C1B1B] text-sm">คอลัมน์ในไฟล์ ↔ ช่องข้อมูลของระบบ</h3>
          </div>

          <div className="flex flex-col gap-4">
            {FIELDS.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-[#e51c23]"> *</span>}
                </label>
                <select
                  value={mapping[field.key]}
                  onChange={(e) => onMappingChange({ ...mapping, [field.key]: e.target.value })}
                  className={`w-full bg-white border rounded-none p-2.5 text-sm focus:border-[#e51c23] focus:ring-1 focus:ring-[#e51c23] text-[#1C1B1B] font-medium ${
                    field.required && !mapping[field.key] ? 'border-red-300 bg-red-50/40' : 'border-gray-300'
                  }`}
                >
                  <option value="">-- ไม่ใช้ --</option>
                  {preview.headers.map((header, idx) => (
                    <option key={`${header}-${idx}`} value={header}>
                      {String(header).trim() || `(คอลัมน์ ${idx + 1})`}
                    </option>
                  ))}
                </select>
                {(field.hint || (field.required && !mapping[field.key])) && (
                  <p className={`text-xs mt-1.5 ${field.required && !mapping[field.key] ? 'text-[#e51c23] font-bold' : 'text-gray-400'}`}>
                    {field.required && !mapping[field.key]
                      ? 'กรุณาเลือกคอลัมน์'
                      : `ตัวอย่าง: ${field.hint}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Preview Table */}
        <div className="bg-white rounded-none shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-[#1C1B1B] text-sm">ตัวอย่างข้อมูลที่จะนำเข้า ({Math.min(preview.rows.length, 8)} จาก {preview.rows.length.toLocaleString()} แถว)</h3>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="min-w-full text-left text-sm border-collapse">
              <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-[#5F5E5E] w-12">ลำดับ</th>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-[#5F5E5E]">รหัสสินค้า</th>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-[#5F5E5E]">ชื่อสินค้า</th>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-[#5F5E5E] text-right">จำนวน</th>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-[#5F5E5E]">หน่วย</th>
                  <th className="py-3 px-4 font-bold text-xs uppercase text-[#5F5E5E] text-right">ราคา/หน่วย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-500 text-sm">
                      <AlertCircle size={28} className="mx-auto mb-2 text-gray-400" />
                      ไม่พบข้อมูลแถวรายการในไฟล์ — กรุณาตรวจสอบไฟล์อีกครั้ง
                    </td>
                  </tr>
                ) : (
                  previewRows.map((_, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-2.5 px-4 text-gray-400 text-xs">{rowIdx + 1}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-[#1C1B1B]">{getCellValue(rowIdx, 'code') || <span className="text-red-400">— ว่าง —</span>}</td>
                      <td className="py-2.5 px-4 text-[#1C1B1B] font-medium">{getCellValue(rowIdx, 'name') || <span className="text-red-400">— ว่าง —</span>}</td>
                      <td className="py-2.5 px-4 text-right text-[#1C1B1B]">{getCellValue(rowIdx, 'quantity')}</td>
                      <td className="py-2.5 px-4 text-[#5F5E5E] text-xs">{getCellValue(rowIdx, 'unit') || 'ชิ้น'}</td>
                      <td className="py-2.5 px-4 text-right text-[#1C1B1B]">{getCellValue(rowIdx, 'price')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-8 flex items-center justify-between bg-white border border-gray-100 shadow-sm p-4 rounded-none sticky bottom-4">
        <button
          type="button"
          onClick={() => setCurrentView('excel')}
          className="bg-white border border-gray-300 hover:bg-gray-50 text-[#1C1B1B] px-6 py-3 rounded-none text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
        >
          <ChevronLeft size={16} />
          ย้อนกลับเลือกไฟล์ใหม่
        </button>

        {missingRequired.length > 0 && (
          <p className="text-xs text-[#e51c23] font-bold flex items-center gap-1.5">
            <AlertCircle size={14} />
            กรุณาเลือกคอลัมน์: {missingRequired.map((f) => f.label).join(', ')}
          </p>
        )}

        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="bg-[#e51c23] hover:bg-[#c9181f] text-white px-8 py-3 rounded-none text-xs font-bold flex items-center gap-2 transition-all shadow-xs disabled:bg-gray-400 cursor-pointer"
        >
          <CheckCircle2 size={16} />
          <span>ยืนยันการจับคู่คอลัมน์</span>
        </button>
      </div>
    </div>
  );
}
