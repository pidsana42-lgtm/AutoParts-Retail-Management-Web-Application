import React from "react";
import Text from "../elements/text";
import { cn } from "../../utils/component";

export interface PromptPayQRData {
  qrCode?: string;
  refNo?: string;
  promptPayName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
}

export interface PromptPayQRPanelProps {
  finalTotal: number;
  qrCodeData: PromptPayQRData | null;
  isLoading: boolean;
  onRetry: () => void;
  netTotalTitle?: string;
  subtitle?: string;
  meta?: {
    date: string;
    time: string;
    staff: string;
  };
  className?: string;
}

export const PromptPayQRPanel: React.FC<PromptPayQRPanelProps> = ({
  finalTotal,
  qrCodeData,
  isLoading,
  onRetry,
  netTotalTitle = "ยอดชำระสุทธิ",
  subtitle = "พร้อมเพย์รับชำระเงิน",
  meta,
  className,
}) => {

  // กรอบแสดง QR Code พร้อมเพย์ และข้อมูลบัญชีธนาคารประกอบ
  // ข้อมูลชื่อพร้อมเพย์ / ร้านค้า, ข้อมูลบัญชีธนาคารประกอบ (ชื่อธนาคาร, เลขบัญชี, ชื่อบัญชี), Ref No. และข้อมูลเจ้าหน้าที่ (วันที่, เวลา, ผู้ดำเนินการ)
  // กล่องยอดชำระสุทธิด้านขวาของกรอบ QR Code พร้อมเพย์
  return (
    <div className={cn("bg-white p-6 border border-[#E7BDB8]/50", className)}>
      <div className="grid grid-cols-2 gap-4">
        {/* ฝั่งซ้าย: รูป QR Code + ข้อมูลพร้อมเพย์/ธนาคาร */}
        <div className="flex flex-col items-center justify-between h-full">
          {/* กรอบรูป QR Code */}
          <div className="relative w-52 h-52 flex items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center text-gray-400 h-full">
                <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E51C23] mb-2"></span>
                <Text variant="xs" className="text-xs mb-0">
                  กำลังสร้าง QR Code...
                </Text>
              </div>
            ) : qrCodeData?.qrCode ? (
              <img
                src={qrCodeData.qrCode}
                alt="PromptPay QR Code"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center text-gray-400 text-center p-2">
                <p className="text-xs text-red-500 mb-2">ไม่สามารถโหลด QR Code ได้</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-3 py-1 bg-white text-gray-700 text-xs rounded border border-gray-200 hover:bg-gray-50 transition cursor-pointer"
                >
                  ลองใหม่อีกครั้ง
                </button>
              </div>
            )}
          </div>

          {/* ข้อความใต้ QR Code */}
          <div className="flex-1 flex flex-col items-center justify-end text-center space-y-2.5 w-full max-w-[220px] pt-3">
            {/* ชื่อพร้อมเพย์ / ร้านค้า */}
            <div className="space-y-1">
              <Text variant="xs" className="font-medium text-[#1C1B1B] truncate block mb-0">
                {qrCodeData?.promptPayName || "เจเจ อะไหล่ยนต์"}
              </Text>
              <Text variant="xs" className="text-[#6B7280] leading-tight block mb-0">
                {subtitle}
              </Text>
            </div>

            {/* ข้อมูลบัญชีธนาคารประกอบ */}
            {qrCodeData?.bankAccountNumber && (
              <div className="w-full pt-2.5 border-t border-gray-100 space-y-1">
                <Text variant="xs" className="font-medium text-[#1C1B1B] truncate block mb-0">
                  {qrCodeData.bankName || "บัญชีธนาคาร"}
                </Text>
                <Text variant="xs" className="text-[#6B7280] truncate block mb-0">
                  {qrCodeData.bankAccountNumber}
                </Text>
                {qrCodeData.bankAccountName && (
                  <Text variant="xs" className="text-[#6B7280] truncate block mb-0">
                    {qrCodeData.bankAccountName}
                  </Text>
                )}
              </div>
            )}

            {/* Ref No. ด้านล่างสุด */}
            {qrCodeData?.refNo && (
              <div className="pt-2.5 w-full border-t border-dashed border-gray-100">
                <Text variant="xs" className="font-light text-gray-400 block truncate mb-0">
                  Ref: {qrCodeData.refNo}
                </Text>
              </div>
            )}
          </div>
        </div>

        {/* ฝั่งขวา: ยอดชำระสุทธิ + ข้อมูลเจ้าหน้าที่ */}
        <div className="flex flex-col justify-between h-full">
          {/* 1. กล่องยอดชำระสุทธิ (ขอบล่างตรงกับกรอบ QR Code) */}
          <div className="h-52 flex flex-col justify-end pb-5">
            <div className="border-l-3 border-[#E51C23] p-4 bg-[#F0EDEC]">
              <Text variant="xs" className="text-[#5F5E5E] mb-0">
                {netTotalTitle}
              </Text>
              <div className="flex justify-between items-baseline mt-2">
                <Text variant="fourxl">
                  {finalTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
                <Text variant="xs" className="text-[#1C1B1B] mb-0">
                  บาท
                </Text>
              </div>
            </div>
          </div>

          {/* 2. เส้นคั่น + รายละเอียด วันที่ / เวลา / ผู้ดำเนินการ */}
          {meta && (
            <div className="flex-1 flex flex-col justify-end pt-3">
              <div className="space-y-2 w-full">
                <div className="border-b border-[#E7BDB8]"></div>
                <div>
                  <div className="flex justify-between items-center">
                    <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">
                      วันที่
                    </Text>
                    <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">
                      {meta.date}
                    </Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">
                      เวลา
                    </Text>
                    <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">
                      {meta.time}
                    </Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">
                      ผู้ดำเนินการ
                    </Text>
                    <Text variant="xs" className="text-[#1C1B1B] font-normal ml-2 mb-0">
                      {meta.staff}
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptPayQRPanel;
