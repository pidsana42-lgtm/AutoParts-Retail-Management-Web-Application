import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ValidationModalProps {
  showValidationModal: boolean;
  setShowValidationModal: (show: boolean) => void;
  validationWarnings: string[];
  setValidationWarnings: (warnings: string[]) => void;
  onConfirmAction: (() => void) | null;
  setOnConfirmAction: (action: (() => void) | null) => void;
}

export default function ValidationModal({
  showValidationModal,
  setShowValidationModal,
  validationWarnings,
  setValidationWarnings,
  onConfirmAction,
  setOnConfirmAction
}: ValidationModalProps) {
  if (!showValidationModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-none shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-300">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center gap-3 text-red-800">
          <AlertCircle className="w-6 h-6 shrink-0 text-[#e51c23]" />
          <div>
            <h3 className="font-bold text-lg text-[#1C1B1B]">คำเตือน: ตรวจพบข้อมูลไม่สอดคล้องหรือน่าสงสัย</h3>
            <p className="text-xs text-red-700 font-medium">กรุณาตรวจสอบรายละเอียดด้านล่างก่อนยืนยันบันทึกข้อมูล</p>
          </div>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <p className="text-sm text-[#5F5E5E] leading-relaxed">
            ระบบวิเคราะห์ข้อมูลใบเสร็จของคุณแล้วพบจุดผิดพลาดหรือแจ้งเตือนที่อาจเกิดจากความไม่สอดคล้อง (เช่น ยอดผลรวมต่างกัน, จำนวน/ราคาไม่ตรงกับใบสั่งซื้อ PO หรือยังไม่ได้จับคู่สินค้า)
          </p>
          <div className="space-y-2">
            {validationWarnings.map((w, idx) => (
              <div key={idx} className="flex gap-2 text-xs text-red-700 bg-red-50 p-2 rounded-none border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#e51c23] mt-0.5" />
                <span className="font-semibold whitespace-pre-wrap">{w}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowValidationModal(false);
              setValidationWarnings([]);
              setOnConfirmAction(null);
            }}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-none hover:bg-gray-105 cursor-pointer"
          >
            ย้อนกลับไปแก้ไข
          </button>
          <button
            type="button"
            onClick={() => {
              setShowValidationModal(false);
              if (onConfirmAction) {
                onConfirmAction();
              }
            }}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#e51c23] hover:bg-[#c9181f] rounded-none cursor-pointer"
          >
            ยืนยันบันทึกข้อมูลต่อไป
          </button>
        </div>
      </div>
    </div>
  );
}
