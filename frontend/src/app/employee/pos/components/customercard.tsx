import React from "react";
import type { CustomerDiscountResponse } from "../../../../interface/pos/customer_interface";
import Text from "../../../../components/elements/text";
import { BadgeCheck } from "lucide-react";
// กำหนดพร็อพเพอร์ตี้ (Props) ที่ Component นี้ต้องการรับจากหน้าหลัก
interface CustomerCardProps {
  customer: CustomerDiscountResponse | null; // รับข้อมูลลูกค้า ถ้าไม่มี (null) แปลว่าเป็นลูกค้ารายย่อยทั่วไป
}

export function CustomerCard({ customer }: CustomerCardProps): React.JSX.Element {

  const isGuest =! customer || customer.id === 0; // ตรวจสอบว่าลูกค้าเป็นขาจรหรือไม่ (ID=0)
  const hasCreditLimit = customer && customer.max_credit_limit > 0; // ตรวจสอบว่าลูกค้ามีวงเงินเครดิตหรือไม่
  const creditUsagePercentage = hasCreditLimit ? (customer!.current_debt_amount / customer!.max_credit_limit) * 100 : 0; // คำนวณ % การใช้เครดิต
  return (
    /* โครงการ์ดหลัก: กล่องสีดำสไตล์ดุดัน (#1C1B1B) พร้อมเส้นขอบสีเทาเข้ม */
    <div className="bg-[#1C1B1B] text-white p-5 mb-6 border border-zinc-800 shadow-lg relative overflow-hidden">
      
      {/* ─── ส่วนที่ 1: ชื่อลูกค้า และ ป้ายสถานะระดับราคา (Header Section) ─── */}
      <div className="flex justify-between items-start">
        <div>
          <Text variant="lead" className= "mb-0 leading-tight text-white">
            {customer?.customer_name || "ลูกค้าทั่วไป (หน้าร้าน)"}
          </Text>
          <Text variant="xs" className= "mb-0 leading-tight text-[#9CA3AF]">
            โทร: {customer?.phone_number || "ลูกค้าทั่วไป (ไม่ระบุ)"}
          </Text>
        </div>
        
        {/* ป้ายระดับราคาพิเศษ */}
        <div className="bg-[#006E0A] text-white text-[10px] px-2.5 py-1 select-none uppercase tracking-wide">
          {!isGuest && customer?.is_discount_enabled ? "ระดับราคาพิเศษ" : "ระดับราคามาตรฐาน"}
        </div>
      </div>

      {/* ─── ส่วนที่ 2: แถบเปอร์เซ็นต์แสดงการใช้เครดิต (Credit Progress Bar) ─── */}
      <div className="mt-4">
        <div className="flex justify-between items-center text-[11px] text-[#9CA3AF] font-light mb-1">
          <span>การใช้เครดิตในระดับราคานี้</span>
          {/* สูตรคำนวณหา % เครดิตที่ใช้ไป: (หนี้ปัจจุบัน / วงเงินสูงสุด) * 100 */}
          <span className=" text-white ">
            {customer && customer.max_credit_limit ? `${((customer.current_debt_amount / customer.max_credit_limit) * 100).toFixed(0)}%` : "0%"}
          </span>
        </div>
        {/* แถบ Progress Bar สีเทา-เงินเพื่อระบุความหนาแน่นของหนี้คงค้าง */}
        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-zinc-400 h-full transition-all duration-500"
            style={{
              // คำนวณความกว้างของแถบวิ่ง (จำกัดไว้ไม่ให้เกิน 100% ป้องกันหลุดหน้าจอ)
              width: customer && customer.max_credit_limit ? `${Math.min(100, (customer.current_debt_amount / customer.max_credit_limit) * 100)}%` : "0%",
            }}
          />
        </div>
      </div>

      {/* ─── ส่วนที่ 3: ตารางเปรียบเทียบยอดหนี้และเครดิตคงเหลือ (Financial Info Grid) ─── */}
      <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-zinc-800/60">
        
        {/* กล่องซ้าย: ยอดหนี้ค้างชำระปัจจุบัน (Current Debt) */}
        <div className="bg-[#262525] p-3 border border-zinc-800/40">
          <Text variant="xs" className="mb-0 text-[10px] text-zinc-500 font-light uppercase tracking-wider">
            ยอดคงเหลือปัจจุบัน
          </Text>
          <Text variant="body" className="mb-0 mt-1 text-base text-zinc-300">
            ฿{customer && customer.current_debt_amount ? customer.current_debt_amount.toFixed(2) : "0.00"}
          </Text>
        </div>
        
        {/* กล่องขวา: จำนวนเงินวงเงินเครดิตที่ยังสามารถติดหนี้เพิ่มได้ (Remaining Credit) */}
        <div className="bg-[#262525] p-3 border border-zinc-800/40">
          <Text variant="xs" className="mb-0 text-[10px] text-zinc-500 font-light uppercase tracking-wider">
            เครดิตคงเหลือ
          </Text>
          <Text variant="body" className="mb-0 mt-1 text-base text-zinc-300 ">
            {/* สูตรคำนวณหาเครดิตเหลือ: วงเงินสูงสุด - หนี้ปัจจุบัน */}
            ฿{customer && customer.max_credit_limit ? (customer.max_credit_limit - customer.current_debt_amount).toFixed(2) : "0.00"}
          </Text>
        </div>
      </div>

        <div className="mt-4 pl-1 flex items-center gap-1.5">
            <BadgeCheck className="w-3.5 h-3.5 text-zinc-400" strokeWidth={2}/>
            <Text variant="xs" className="mb-0 text-zinc-400 font-extralight tracking-wider whitespace-nowrap">
              วงเงินเครดิต: ฿{customer && customer.max_credit_limit ? customer.max_credit_limit.toFixed(2) : "0.00"}
            </Text>
        </div>

    </div>
  );
}