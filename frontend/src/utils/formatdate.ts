export const formatDate = (dateValue: string | Date | undefined | null) => {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateThai = (
  dateValue: string | Date | undefined | null,
  separator = "/",
) => {
  if (!dateValue) return "-";

  // วันที่จาก API แบบ YYYY-MM-DD ไม่มี timezone จึงต้องแยกค่าโดยตรง
  // เพื่อป้องกันบาง timezone แสดงผลย้อนหลังไปหนึ่งวัน
  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split("-").map(Number);
    return `${String(day).padStart(2, "0")}${separator}${String(month).padStart(2, "0")}${separator}${year + 543}`;
  }

  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return "-";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear() + 543;

  return `${dd}${separator}${mm}${separator}${yyyy}`;
};

export const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

const formatLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const inclusiveDayCount = (start: Date, end: Date) =>
  Math.round((startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) / 86_400_000) + 1;

export const getDashboardPreviousPeriodDateRange = (
  period: string,
  anchor = new Date(),
) => {
  const currentEnd = startOfLocalDay(anchor);
  const currentPeriod = getDashboardPeriodDateRange(period, currentEnd);
  const [currentYear, currentMonth, currentDay] = currentPeriod.startDate.split('-').map(Number);
  const currentStart = new Date(currentYear, currentMonth - 1, currentDay);
  const elapsedDays = inclusiveDayCount(currentStart, currentEnd);

  let previousPeriodStart: Date;
  let previousPeriodEnd: Date;

  switch (period) {
    case 'weekly':
      previousPeriodStart = new Date(currentStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
      previousPeriodEnd = new Date(currentStart);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
      break;
    case 'monthly':
      previousPeriodStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1);
      previousPeriodEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0);
      break;
    case 'quarterly':
      previousPeriodStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 3, 1);
      previousPeriodEnd = new Date(currentStart);
      previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
      break;
    case 'yearly':
      previousPeriodStart = new Date(currentStart.getFullYear() - 1, 0, 1);
      previousPeriodEnd = new Date(currentStart.getFullYear() - 1, 11, 31);
      break;
    default:
      previousPeriodStart = new Date(currentStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
      previousPeriodEnd = new Date(previousPeriodStart);
      break;
  }

  let previousStart = new Date(previousPeriodStart);
  let previousEnd = new Date(previousPeriodStart);
  previousEnd.setDate(previousEnd.getDate() + elapsedDays - 1);

  // A preceding calendar period can be shorter (February, quarter, leap year).
  // Keep the comparison duration exact by anchoring the window at that period's end.
  if (previousEnd > previousPeriodEnd) {
    previousEnd = new Date(previousPeriodEnd);
    previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - elapsedDays + 1);
  }

  return {
    startDate: formatLocalIsoDate(previousStart),
    endDate: formatLocalIsoDate(previousEnd),
  };
};

export const getDashboardPeriodDateRange = (
  period: string,
  anchor = new Date(),
) => {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  let start = new Date(year, month, anchor.getDate());
  let end = new Date(start);

  switch (period) {
    case "weekly":
      start.setDate(start.getDate() - start.getDay());
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      break;
    case "monthly":
      start = new Date(year, month, 1);
      end = new Date(year, month + 1, 0);
      break;
    case "quarterly": {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      start = new Date(year, quarterStartMonth, 1);
      end = new Date(year, quarterStartMonth + 3, 0);
      break;
    }
    case "yearly":
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31);
      break;
    default:
      break;
  }

  return {
    startDate: formatLocalIsoDate(start),
    endDate: formatLocalIsoDate(end),
  };
};

export const getThaiMonthOptions = () => {
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  
  const monthOptions = thaiMonths.map((month, index) => ({
    label: month,
    value: String(index + 1).padStart(2, '0') // จะได้ค่าเป็น "01", "02", ...
  }));

  return [{ label: "ทุกเดือน", value: "" }, ...monthOptions];
};

export const getYearOptions = (availableYears: number[]) => {
  const currentYear = new Date().getFullYear();
  const yearSet = new Set<number>([currentYear, ...availableYears]);

  return Array.from(yearSet)
    .sort((a, b) => b - a)
    .map((year) => ({
      label: String(year + 543),
      value: String(year),
    }));
};
