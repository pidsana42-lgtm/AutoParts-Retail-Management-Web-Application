// src/utils/posHelpers.tsx
import Badge from "../components/elements/badge";
import type { SalesHistoryItemResponse } from "../interface/pos/sales_history_interface";

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
export const getPaymentVariant = (methodName?: string) => {
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
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return isNaN(date.getTime())
    ? dateStr
    : date.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

/**
 * ฟังก์ชัน Render Status Badge สำหรับแสดงสถานะของบิล POS
 */
export const renderStatusBadge = (status: string, paymentStatus: string) => {
  const billStatus = (status || "").trim().toUpperCase();
  const payStatus = (paymentStatus || "").trim().toUpperCase();

  // 1. เช็กการยกเลิกก่อน
  if (billStatus === "PENDING_CANCEL") {
    return (
      <Badge variant="warning" className="rounded-none whitespace-nowrap">
        ส่งคำขอยกเลิกแล้ว
      </Badge>
    );
  }

  if (billStatus === "CANCELLED" || billStatus === "ยกเลิก") {
    return (
      <Badge variant="error" className="rounded-none whitespace-nowrap">
        ยกเลิกแล้ว
      </Badge>
    );
  }

  // 2. ถ้าชำระเงินครบถ้วนแล้ว (paid) -> แสดง "ชำระแล้ว"
  if (payStatus === "PAID" || payStatus === "ชำระแล้ว") {
    return (
      <Badge variant="success" className="rounded-none whitespace-nowrap">
        ชำระแล้ว
      </Badge>
    );
  }

  // 3. ถ้าเป็นบิลเงินเชื่อที่ทำรายการเสร็จแล้ว แต่ยังไม่ชำระ (completed + unpaid/partial)
  if (billStatus === "COMPLETED") {
    return (
      <Badge variant="info" className="rounded-none whitespace-nowrap">
        ทำรายการแล้ว
      </Badge>
    );
  }

  // 4. สถานะรอดำเนินการ / รอตอบรับ
  if (billStatus === "PENDING") {
    return (
      <Badge variant="neutral" className="rounded-none whitespace-nowrap">
        รอดำเนินการ
      </Badge>
    );
  }

  if (billStatus === "OVERDUE" || payStatus === "OVERDUE") {
    return (
      <Badge variant="error" className="rounded-none whitespace-nowrap">
        เกินกำหนด
      </Badge>
    );
  }

  // default สำรองกรณีค่าอื่น
  return (
    <Badge variant="info" className="rounded-none whitespace-nowrap">
      {status || "ไม่ทราบสถานะ"}
    </Badge>
  );
};

/**
 * ฟังก์ชัน Render Status Badge สำหรับแสดงสถานะของบิลในหน้ารายการคำขอยกเลิก (Sales Cancellation History)
 * - PENDING_CANCEL => "รอดำเนินการ" (Warning)
 * - CANCELLED / ยกเลิก => "อนุมัติแล้ว" (Error/Red)
 * - COMPLETED / อื่นๆ (กรณีคำขอถูกปฏิเสธ) => "ไม่อนุมัติ" (Neutral/Gray)
 */
export const renderCancellationStatusBadge = (
  status?: string | null,
  paymentStatus?: string | null,
  cancelRemark?: string | null,
  cancelProcessedAt?: any
) => {
  const billStatus = (status || "").trim().toUpperCase();

  if (billStatus === "PENDING_CANCEL") {
    return (
      <Badge variant="warning" className="rounded-none whitespace-nowrap bg-[#FEF08A] text-[#854D0E] border-none">
        รอดำเนินการ
      </Badge>
    );
  }

  if (billStatus === "CANCELLED" || billStatus === "ยกเลิก") {
    return (
      <Badge variant="error" className="rounded-none whitespace-nowrap bg-[#FEE2E2] text-[#E51C23] border-none">
        อนุมัติแล้ว
      </Badge>
    );
  }

  // หากเป็น COMPLETED หรือสถานะอื่นๆ ในหน้าคำขอยกเลิก แสดง "ไม่อนุมัติ"
  return (
    <Badge variant="neutral" className="rounded-none whitespace-nowrap bg-gray-200 text-gray-700 border-none">
      ไม่อนุมัติ
    </Badge>
  );
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