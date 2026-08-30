// src/utils/poshelpers.ts

/** Type กลางสำหรับดึงชื่อลูกค้า */
export type CustomerNameEntity = {
  customer_name?: string | null;
  customer_name_temp?: string | null;
};

/** ฟังก์ชันช่วยดึงชื่อลูกค้าที่ถูกต้องในการแสดงผล */
export const getDisplayCustomerName = (item?: CustomerNameEntity | null): string => {
  if (!item) return "ลูกค้าทั่วไป";

  if (item.customer_name && item.customer_name.trim() !== "") {
    return item.customer_name.trim();
  }

  if (item.customer_name_temp && item.customer_name_temp.trim() !== "") {
    return `${item.customer_name_temp.trim()} (ขาจร)`;
  }

  return "ลูกค้าทั่วไป";
};

/** คำนวณปุ่มหมายเลขหน้าสำหรับ Pagination */
export const getPageNumbers = (
  currentPage: number,
  totalPages: number
): (number | "...")[] => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, "...", totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
};

/** เลือกประเภท Variant ของ Badge ชำระเงิน */
export const getPaymentVariant = (methodName?: string): "credit" | "transfer" | "cash" | "neutral" => {
  switch (methodName) {
    case "เงินเชื่อ":
    case "CREDIT":
      return "credit";
    case "เงินโอน/สแกน QR":
    case "เงินโอน":
    case "QR":
    case "TRANSFER":
      return "transfer";
    case "เงินสด":
    case "CASH":
      return "cash";
    default:
      return "neutral";
  }
};

/** ฟังก์ชันแปลงรูปแบบวันที่ภาษาไทย */
export const formatDate = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return "-";
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return isNaN(date.getTime())
    ? String(dateStr)
    : date.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

/**
 * เลือก Class สีพื้นหลังของ Badge ชำระเงิน
 */
export const getPaymentBadgeColor = (methodName?: string): string => {
  switch (methodName) {
    case "เงินเชื่อ":
    case "CREDIT":
      return "bg-blue-500";
    case "เงินโอน/สแกน QR":
    case "เงินโอน":
    case "QR":
    case "TRANSFER":
      return "bg-gray-500";
    case "เงินสด":
    case "CASH":
    default:
      return "bg-[#259B24]";
  }
};

/**
 * ฟอร์แมตจำนวนเงินเป็นสกุลเงินบาท (เช่น 1,250.00)
 */
export const formatCurrency = (amount: number | string | undefined | null): string => {
  const val = typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  if (isNaN(val)) return "฿0.00";
  return `${val.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
