import { useMemo } from "react";
import type { CustomerDiscountResponse, ComputedCustomerData } from "../../../../interface/pos/customer_interface";

export function useCustomerFinancials(customer: CustomerDiscountResponse | null): ComputedCustomerData {
  return useMemo(() => {
    // 1. เช็คว่าเป็นลูกค้าทั่วไป (Guest / ขาจร) หรือไม่
    const isGuest = !customer || customer.id === 0;
    
    // 2. เช็คเรื่องสิทธิ์ราคาพิเศษ: ต้องไม่ใช่ลูกค้าขาจร, เปิดสิทธิ์ส่วนลด และมีส่วนลด On-Top มากกว่า 0
    const ontopRate = Number(customer?.ontop_discount_rate) || 0;
    const isDiscountEnabled = !isGuest && Boolean(customer?.is_discount_enabled);
    const isSpecialPrice = isDiscountEnabled && ontopRate > 0;
    
    // 3. ดึงค่าตัวเลขมาเตรียมคำนวณ (กันเหนียวใส่ fallback เป็น 0 ไว้เผื่อข้อมูลมาไม่ครบ)
    const maxLimit = customer?.max_credit_limit || 0;
    const currentDebt = customer?.current_debt_amount || 0;

    // 4. คำนวณเปอร์เซ็นต์การใช้เครดิต (สูตร: (หนี้ปัจจุบัน / วงเงินสูงสุด) * 100)
    // ใช้ Math.min เพื่อจำกัดไม่ให้หลอดเหลื่อมทะลุ 100% และ Math.max เพื่อไม่ให้ติดลบ
    const creditUsagePercentage = maxLimit > 0 
      ? Math.min(100, Math.max(0, (currentDebt / maxLimit) * 100)) 
      : 0;

    // 5. คำนวณเครดิตคงเหลือที่ยังติดหนี้เพิ่มได้
    const remainingCredit = Math.max(0, maxLimit - currentDebt);

    // 6. ส่งข้อมูลที่แปลงเป็น String ทศนิยม 2 ตำแหน่ง พร้อมใช้บน UI ออกไป
    return {
      customerName: customer?.customer_name || "ลูกค้าทั่วไป (หน้าร้าน)",
      phoneNumber: customer?.phone_number || "ลูกค้าทั่วไป (ไม่ระบุ)",
      isGuest,
      isSpecialPrice,
      isDiscountEnabled,
      ontopDiscountRate: ontopRate,
      creditUsagePercentage,
      currentDebtStr: currentDebt.toFixed(2),
      remainingCreditStr: remainingCredit.toFixed(2),
      maxCreditLimitStr: maxLimit.toFixed(2),
      raw: customer
    };
  }, [customer]); // จะคำนવณใหม่ก็ต่อเมื่อ Object ลูกค้ามีการเปลี่ยนแปลงเท่านั้น
}