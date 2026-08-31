export const formatDate = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return "-";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return isNaN(date.getTime())
    ? String(dateInput)
    : date.toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
};

/**
 * ดึงวันที่ปัจจุบันในรูปแบบ YYYY-MM-DD สำหรับ HTML Date Input
 */
export const getTodayDateString = (): string => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * ดึงวันย้อนหลังจากปัจจุบันตามจำนวนวันที่ระบุ ในรูปแบบ YYYY-MM-DD
 */
export const getDaysAgoDateString = (days: number = 30): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};