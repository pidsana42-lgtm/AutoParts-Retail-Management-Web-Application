export const formatDate = (dateValue: string | Date | undefined | null) => {
  if (!dateValue) return "-";
  
  // แปลงให้เป็น Date object (ถ้ารับมาเป็น string มันก็จะแปลง, ถ้ารับมาเป็น Date อยู่แล้วก็ไม่มีปัญหา)
  const date = new Date(dateValue);
  
  // เช็คว่าเป็น Date ที่ถูกต้องไหม (Invalid Date)
  if (isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
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