import React from 'react';
import { ChevronLeft, FileUp } from 'lucide-react';
import Heading from '../../../../components/elements/heading';
import type { ViewState } from '../../../../interface/import';

interface ExcelViewProps {
  setCurrentView: (view: ViewState) => void;
  processExcelFile: (file: File) => void;
}

export default function ExcelView({ setCurrentView, processExcelFile }: ExcelViewProps) {
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processExcelFile(file);
  };

  return (
    <div className="p-8 max-w-full mx-auto w-full animate-in fade-in duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setCurrentView('home')} className="p-2 hover:bg-gray-200 rounded-none transition-colors">
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <Heading level="h1" className="mb-0 font-extrabold text-[#1C1B1B]">นำเข้าใบสั่งซื้อด้วย CSV / Excel</Heading>
      </div>

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
