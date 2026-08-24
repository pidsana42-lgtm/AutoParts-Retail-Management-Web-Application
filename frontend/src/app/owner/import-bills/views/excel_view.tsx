import React from 'react';
import { ChevronRight, FileUp, AlertCircle } from 'lucide-react';
import Heading from '../../../../components/elements/heading';
import type { ViewState } from '../../../../interface/import';

interface ExcelViewProps {
  setCurrentView: (view: ViewState) => void;
  processExcelFile: (file: File) => void;
  errorMsg?: string | null;
  onDismissError?: () => void;
}

export default function ExcelView({ setCurrentView, processExcelFile, errorMsg, onDismissError }: ExcelViewProps) {
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processExcelFile(file);
    e.target.value = '';
  };

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 mb-4">
        <button type="button" onClick={() => setCurrentView('home')} className="hover:text-[#e51c23] transition-colors cursor-pointer font-bold">
          นำเข้าสินค้าจากบิล
        </button>
        <ChevronRight size={14} className="text-gray-400" />
        <span className="text-[#1C1B1B] font-bold">นำเข้าด้วยไฟล์ CSV / Excel</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">
          นำเข้าข้อมูลสินค้าด้วยไฟล์ CSV / Excel
        </Heading>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-none flex items-start gap-3">
          <AlertCircle size={20} className="shrink-0 text-red-500 mt-0.5" />
          <span className="flex-1">{errorMsg}</span>
          {onDismissError && (
            <button type="button" onClick={onDismissError} className="text-red-500 hover:text-red-700 font-bold cursor-pointer shrink-0">
              ✕
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-none shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center text-center min-h-[500px]">
        {/* Centered Icon Box */}
        <div className="bg-[#1c1b1b] text-white p-5 rounded-none mb-6 shadow-sm">
          <FileUp size={48} className="text-white" />
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2">นำเข้าไฟล์สั่งซื้ออะไหล่ (Excel / CSV)</h3>
        <p className="text-[#5F5E5E] text-sm max-w-md mb-8 leading-relaxed">
          อัปโหลดไฟล์ในรูปแบบ Excel (.xlsx, .xls) หรือ CSV (.csv) เพื่อนำข้อมูลไปแปลงเป็นหน้าตารางและทำการตรวจสอบแก้ไขได้ทันที
        </p>

        <label className="cursor-pointer text-white bg-[#e51c23] hover:bg-[#c9181f] px-8 py-3 rounded-none font-bold transition-all shadow-sm">
          เลือกไฟล์ Excel / CSV เพื่อนำเข้า
          <input 
            type="file" 
            className="hidden" 
            accept=".csv, .xlsx, .xls" 
            onChange={handleExcelFileChange} 
          />
        </label>
      </div>
    </div>
  );
}
