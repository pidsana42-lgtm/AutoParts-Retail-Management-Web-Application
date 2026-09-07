// src/utils/customerhelpers.ts

/**
 * Helper สำหรับคำนวณ Badge Variant ของประเภทลูกค้า
 */
export const getCustomerTypeVariant = (
  typeName?: string,
  typeLabel?: string
): "garage" | "wholesale" | "customer" => {
  const name = typeName?.toUpperCase() || "";
  if (name === "GARAGE" || typeLabel?.includes("อู่")) {
    return "garage";
  }
  if (name === "WHOLESALE" || typeLabel?.includes("บริษัท")) {
    return "wholesale";
  }
  return "customer";
};

/**
 * Helper สำหรับดึง Label ของประเภทลูกค้า
 */
export const getCustomerTypeLabel = (
  typeName?: string,
  typeLabel?: string
): string => {
  if (typeLabel) return typeLabel;
  const name = typeName?.toUpperCase() || "";
  if (name === "GARAGE") return "ลูกค้าอู่";
  if (name === "WHOLESALE") return "ลูกค้าบริษัท";
  return "ลูกค้าทั่วไป";
};

/**
 * Data Masking สำหรับเบอร์โทรศัพท์ (PDPA Compliant)
 * ตัวอย่าง: 081-234-5678 -> 081-XXX-5678
 *          044-222-333  -> 044-XXX-333
 */
export const maskPhoneNumber = (phone?: string | null): string => {
  if (!phone || !phone.trim() || phone === "-") return "-";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 10) {
    return `${clean.slice(0, 3)}-XXX-${clean.slice(6)}`;
  }
  if (clean.length === 9) {
    return `${clean.slice(0, 3)}-XXX-${clean.slice(6)}`;
  }
  if (clean.length > 5) {
    return `${clean.slice(0, 3)}-XXXX-${clean.slice(-2)}`;
  }
  return phone;
};

/**
 * Data Masking สำหรับเลขประจำตัวประชาชน / นิติบุคคล (PDPA Compliant)
 * ตัวอย่าง: 1-1002-00342-99-1 -> 1-XXXX-XXXXX-99-1
 *          1100200342991     -> 1-XXXX-XXXXX-99-1
 */
export const maskIdCardNumber = (idCard?: string | null): string => {
  if (!idCard || !idCard.trim() || idCard === "-") return "-";
  const clean = idCard.replace(/\D/g, "");
  if (clean.length === 13) {
    return `${clean[0]}-XXXX-XXXXX-${clean.slice(10, 12)}-${clean[12]}`;
  }
  if (clean.length === 10) {
    return `${clean.slice(0, 2)}-XXXX-X-${clean.slice(-3)}`;
  }
  if (clean.length > 6) {
    const keepStart = 2;
    const keepEnd = 3;
    const maskedLen = Math.max(clean.length - keepStart - keepEnd, 4);
    return `${clean.slice(0, keepStart)}${"X".repeat(maskedLen)}${clean.slice(-keepEnd)}`;
  }
  return idCard;
};

