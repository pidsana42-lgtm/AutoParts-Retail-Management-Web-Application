import type { ValidateDiscountPolicyProps, DiscountPolicyResult } from "../../../../interface/pos/discount_interface";


export function useDiscountCalculation() {
  
  // คำนวณยอดส่วนลดรายไอเทมออกมาเป็น "บาท"
  const calculateLineDiscountAmount = (
    unitPrice: number,
    qty: number,
    discountType: "none" | "percentage" | "amount",
    discountValue: number
  ): number => {
    const lineTotal = unitPrice * qty;
    if (discountType === "percentage") return (lineTotal * discountValue) / 100;
    if (discountType === "amount") return discountValue;
    return 0;
  };

  // เช็คกฎเหล็ก (คุมเพดานส่วนลดของสินค้า + โควตาพิเศษของกลุ่มอู่ซ่อมรถ)
  const validateLineDiscountPolicy = ({
    rawValue,
    discountType,
    unitPrice,
    qty,
    maxDiscountRate,
    customer,
    activeTypeId,
  }: ValidateDiscountPolicyProps): DiscountPolicyResult => { // ใช้ Type Result ที่แยกมา
    const currentCustomerTypeId = customer?.customer_type?.id || activeTypeId;
    const currentCustomerTypeName = customer?.customer_type?.type_name || "";

    // กฎเหล็กกลุ่ม WHOLESALE
    if (currentCustomerTypeId === 3 || currentCustomerTypeName === "WHOLESALE") {
      return { isValid: false, errorMsg: "ลูกค้ากลุ่มบริษัทไม่ได้รับสิทธิ์ส่วนลดใดๆ ทั้งสิ้น" };
    }

    const lineTotal = unitPrice * qty;
    let allowedMaxRate =
      maxDiscountRate !== undefined && maxDiscountRate !== null && Number(maxDiscountRate) > 0
        ? Number(maxDiscountRate)
        : 2.0;

    // สิทธิ์ส่วนลดลูกค้าประจำ (standard_discount_rate)
    if (customer && customer.is_discount_enabled && Number(customer.standard_discount_rate) > 0) {
      allowedMaxRate = Math.max(allowedMaxRate, Number(customer.standard_discount_rate));
    }

    // กฎโหมดอู่ซ่อมรถ (+ ontop)
    const isDiscountEnabled = customer ? customer.is_discount_enabled : false;
    const ontopRate = customer ? (Number((customer as any).ontop_discount_rate) || 0) : 0;
    const isGarageMode =
      isDiscountEnabled &&
      ontopRate > 0 &&
      (currentCustomerTypeId === 2 ||
        currentCustomerTypeName === "GARAGE" ||
        customer?.customer_name?.includes("อู่"));

    if (isGarageMode) {
      allowedMaxRate += ontopRate;
    }

    // แปลงค่าที่พนักงานกรอกเป็น % เพื่อเช็คเพดาน
    let inputLineDiscountPercent = 0;
    if (discountType === "percentage") {
      inputLineDiscountPercent = rawValue;
    } else if (discountType === "amount" && lineTotal > 0) {
      inputLineDiscountPercent = (rawValue / lineTotal) * 100;
    }

    if (inputLineDiscountPercent > allowedMaxRate + 0.01) {
      const maxDiscountBaht = (lineTotal * allowedMaxRate) / 100;
      return {
        isValid: false,
        errorMsg:
          discountType === "percentage"
            ? `ไม่สามารถให้ส่วนลดเกินเพดานของสินค้านี้ได้ (สูงสุดไม่เกิน ${allowedMaxRate.toFixed(2)}%)`
            : `ไม่สามารถให้ส่วนลดเกินเพดานของสินค้านี้ได้ (สูงสุดไม่เกิน ฿${maxDiscountBaht.toFixed(2)})`,
      };
    }

    return { isValid: true };
  };

  // ถัวเฉลี่ยคำนวณกระจายส่วนลดท้ายบิล (Pro-rata)
  const calculateProRataWeight = (
    subtotalAfterLineDiscount: number,
    totalSubtotalAfterLineDiscount: number,
    computedBillDiscount: number
  ): number => {
    if (totalSubtotalAfterLineDiscount <= 0 || computedBillDiscount <= 0) return 0;
    const weight = subtotalAfterLineDiscount / totalSubtotalAfterLineDiscount;
    return Math.round(computedBillDiscount * weight * 100) / 100;
  };

  return {
    calculateLineDiscountAmount,
    validateLineDiscountPolicy,
    calculateProRataWeight,
  };
}