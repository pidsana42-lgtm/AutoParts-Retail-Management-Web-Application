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
