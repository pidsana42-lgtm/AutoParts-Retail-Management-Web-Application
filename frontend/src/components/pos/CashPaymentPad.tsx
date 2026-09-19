import React from "react";
import Text from "../elements/text";
import Input from "../elements/input";
import { cn } from "../../utils/component";

export interface CashPaymentPadProps {
  finalTotal: number;
  receivedAmount: number;
  displayValue: string;
  onReceivedAmountChange: (value: string) => void;
  onAddAmount: (amount: number) => void;
  onExactPayment: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  quickAmounts?: number[];
  netTotalTitle?: string;
  meta?: {
    date: string;
    time: string;
    staff: string;
  };
  className?: string;
}

export const CashPaymentPad: React.FC<CashPaymentPadProps> = ({
  finalTotal,
  receivedAmount,
  displayValue,
  onReceivedAmountChange,
  onAddAmount,
  onExactPayment,
  onBlur,
  onFocus,
  quickAmounts = [10, 20, 50, 100, 500, 1000],
  netTotalTitle = "ยอดชำระสุทธิ",
  meta,
  className,
}) => {
  const changeAmount = Math.max(0, receivedAmount - finalTotal);

  // รวม UI แผงรับเงินสดทั้งหมดไว้ในคอมโพเนนต์เดียว
  // แป้นปุ่มลัดรับเงินสด, กล่องแสดงยอดชำระสุทธิ, ยอดเงินทอน, ปุ่มเพิ่มจำนวนเงินที่รับมา, ปุ่มจ่ายพอดี, และข้อมูลเจ้าหน้าที่
  //แสดงข้อมูลวันที่, เวลา, และผู้ดำเนินการ (เจ้าหน้าที่) ด้านขวาของปุ่มเพิ่มจำนวนเงินที่รับมาและปุ่มจ่ายพอดี
  return (
    <div className={cn("space-y-4", className)}>
      {/* 1. กล่องยอดชำระสุทธิ และ ยอดเงินทอน */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border-l-3 border-[#E51C23] p-4 bg-[#F0EDEC]">
          <Text variant="xs" className="text-[#5F5E5E]">
            {netTotalTitle}
          </Text>
          <div className="flex justify-between items-baseline mt-2">
            <Text variant="fourxl">
              {finalTotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            <Text variant="xs" className="text-[#1C1B1B]">
              บาท
            </Text>
          </div>
        </div>
        <div className="border-l-3 border-[#006E0A] p-4 bg-[#86F976]/20">
          <Text variant="xs" className="text-[#259B24]">
            ยอดเงินทอน
          </Text>
          <div className="flex justify-between items-baseline mt-2">
            <Text
              variant="fourxl"
              className={cn(
                "text-[#259B24] truncate",
                changeAmount > 999999 ? "text-2xl" : "text-4xl"
              )}
            >
              {changeAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            <Text variant="xs" className="text-[#259B24]">
              บาท
            </Text>
          </div>
        </div>
      </div>

      {/* 2. ส่วนรับเงินมา */}
      <div className="flex flex-col gap-1.5">
        <Text variant="small" className="text-[#1C1B1B] font-medium">
          รับเงินมา
        </Text>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-baseline justify-between w-full px-4 py-4 bg-white border-b-2 border-[#E7BDB8]">
            <Input
              type="text"
              inputMode="decimal"
              className="w-full text-4xl text-[#1C1B1B] font-semibold bg-transparent border-none focus:outline-none [appearance:textfield]"
              value={displayValue || ""}
              onChange={(e) => onReceivedAmountChange(e.target.value)}
              onBlur={onBlur}
              onFocus={onFocus}
              placeholder="0.00"
            />
            <Text variant="xs" className="text-[#1C1B1B] ml-2 font-medium">
              บาท
            </Text>
          </div>
          <div className="flex items-center justify-between w-full px-4 py-6 border-b border-[#E7BDB8]"></div>
        </div>

        {/* 3. ปุ่มเพิ่มจำนวนเงินที่รับมา + ปุ่มจ่ายพอดี + ข้อมูลเจ้าหน้าที่ */}
        <div className="grid grid-cols-2 gap-4">
          {/* ปุ่มเพิ่มจำนวนเงินที่รับมา */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => onAddAmount(amount)}
                className="flex items-center justify-center px-2 py-4 bg-[#E5E2E1] rounded-none text-xs font-medium text-[#1C1B1B] hover:bg-[#D9D9D9] transition-all truncate cursor-pointer"
              >
                {amount} บาท
              </button>
            ))}
            <button
              type="button"
              onClick={onExactPayment}
              className="col-span-3 py-2 bg-[#1C1B1B] text-white hover:bg-zinc-900 text-xs font-normal rounded-none transition-colors cursor-pointer"
            >
              จ่ายพอดี (฿{finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </button>
          </div>

          {/* ฝั่งขวา: วันที่, เวลา, ผู้ดำเนินการ */}
          {meta && (
            <div className="mt-4 space-y-1">
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
          )}
        </div>
      </div>
    </div>
  );
};

export default CashPaymentPad;
