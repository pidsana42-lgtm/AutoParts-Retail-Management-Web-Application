import React from "react";
import type { CustomerDiscountResponse } from "../../../../interface/pos/customer_interface";
import { useCustomerFinancials } from "../hooks/useCustomerFinancials";
import Text from "../../../../components/elements/text";
import { BadgeCheck } from "lucide-react";

interface CustomerCardProps {
  customer: CustomerDiscountResponse | null;
  address?: string;
}

export function CustomerCard({ customer, address }: CustomerCardProps): React.JSX.Element {
  // เรียกใช้ Hook ชุดเดียวกันเพื่อแปลง Data ออกมา
  const {
    customerName,
    phoneNumber,
    isSpecialPrice,
    creditUsagePercentage,
    currentDebtStr,
    remainingCreditStr,
    maxCreditLimitStr
  } = useCustomerFinancials(customer);

  return (
    <div className="bg-[#1C1B1B] text-white p-5 mb-6 border border-zinc-800 shadow-lg relative overflow-hidden">
      
      <div className="flex justify-between items-start">
        <div>
          <Text variant="lead" className="mb-0 leading-tight text-white">{customerName}</Text>
          <Text variant="xs" className="mb-0 leading-tight text-[#9CA3AF]">โทร: {phoneNumber}</Text>
          <Text variant="xs" className="mb-0 leading-tight text-[#9CA3AF] truncate max-w-[200px]" title={address || customer?.shipping_address || customer?.registered_address || "ไม่ได้ระบุที่อยู่"}>
            ที่อยู่: {address || customer?.shipping_address || customer?.registered_address || "ไม่ได้ระบุที่อยู่"}
          </Text>
        </div>
        <div className="bg-[#006E0A] text-white text-[10px] px-2.5 py-1 select-none uppercase tracking-wide">
          {isSpecialPrice ? "ระดับราคาพิเศษ" : "ระดับราคามาตรฐาน"}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between items-center text-[11px] text-[#9CA3AF] font-light mb-1">
          <span>การใช้เครดิตในระดับราคานี้</span>
          <span className="text-white">{creditUsagePercentage.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-zinc-400 h-full transition-all duration-500"
            style={{ width: `${creditUsagePercentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-zinc-800/60">
        <div className="bg-[#262525] p-3 border border-zinc-800/40">
          <Text variant="xs" className="mb-0 text-[10px] text-zinc-500 font-light uppercase tracking-wider">ยอดคงเหลือปัจจุบัน</Text>
          <Text variant="body" className="mb-0 mt-1 text-base text-zinc-300">฿{currentDebtStr}</Text>
        </div>
        <div className="bg-[#262525] p-3 border border-zinc-800/40">
          <Text variant="xs" className="mb-0 text-[10px] text-zinc-500 font-light uppercase tracking-wider">เครดิตคงเหลือ</Text>
          <Text variant="body" className="mb-0 mt-1 text-base text-zinc-300">฿{remainingCreditStr}</Text>
        </div>
      </div>

      <div className="mt-4 pl-1 flex items-center gap-1.5">
        <BadgeCheck className="w-3.5 h-3.5 text-zinc-400" strokeWidth={2}/>
        <Text variant="xs" className="mb-0 text-zinc-400 font-extralight tracking-wider whitespace-nowrap">
          วงเงินเครดิต: ฿{maxCreditLimitStr}
        </Text>
      </div>

    </div>
  );
}