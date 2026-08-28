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
    ontopDiscountRate,
    creditUsagePercentage,
    currentDebtStr,
    remainingCreditStr,
    maxCreditLimitStr
  } = useCustomerFinancials(customer);

  const displayAddress =
    address?.trim() ||
    customer?.shipping_address?.trim() ||
    customer?.registered_address?.trim() ||
    customer?.display_address?.trim() ||
    customer?.address?.trim() ||
    "ไม่ได้ระบุที่อยู่";

  return (
    <div className="bg-[#1C1B1B] text-white p-5 mb-6 border border-zinc-800 shadow-lg relative overflow-hidden">
      
      <div className="flex justify-between items-start">
        <div className="flex-1 pr-2">
          <Text variant="lead" className="mb-0 leading-tight text-white">{customerName}</Text>
          <Text variant="xs" className="mb-0 leading-tight text-[#9CA3AF] mt-1">โทร: {phoneNumber}</Text>
          <div className="flex items-start gap-1 mt-1 text-[#9CA3AF]">
            <Text variant="xs" className="mb-0 leading-normal text-[#9CA3AF] break-words text-[11px]" title={address || customer?.shipping_address || customer?.registered_address || "ไม่ได้ระบุที่อยู่"}>
            ที่อยู่: {displayAddress|| "ไม่ได้ระบุที่อยู่"}
            </Text>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className={`text-white text-[10px] px-2.5 py-1 select-none uppercase tracking-wide shrink-0 ${
            isSpecialPrice ? "bg-[#259B24]" : "bg-zinc-700 text-zinc-300"
          }`}>
            {isSpecialPrice ? "ระดับราคาพิเศษ" : "ระดับราคามาตรฐาน"}
          </div>
          {ontopDiscountRate > 0 ? (
            <span className="text-[11px] text-[#259B24] font-normal tracking-wide">
              On-Top: +{ontopDiscountRate}%
            </span>
          ) : (
            <span className="text-[11px] text-zinc-500 font-light tracking-wide">
              On-Top: 0%
            </span>
          )}
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

      <div className="mt-4 pl-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BadgeCheck className="w-3.5 h-3.5 text-zinc-400" strokeWidth={2}/>
          <Text variant="xs" className="mb-0 text-zinc-400 font-extralight tracking-wider whitespace-nowrap">
            วงเงินเครดิต: ฿{maxCreditLimitStr}
          </Text>
        </div>
        <div>
          {ontopDiscountRate > 0 ? (
            <span className="text-[#259B24] bg-[#259B24]/20 border border-[#86F976]/50 px-2 py-0.5 text-[10px] font-medium tracking-wide">
              ส่วนลด On-Top {ontopDiscountRate}%
            </span>
          ) : (
            <span className="text-zinc-500 text-[10px] font-light">
              ไม่มีส่วนลด On-Top
            </span>
          )}
        </div>
      </div>

    </div>
  );
}