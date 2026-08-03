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
  
  return thaiMonths.map((month, index) => ({
    label: month,
    value: String(index + 1).padStart(2, '0') // จะได้ค่าเป็น "01", "02", ...
  }));
};

export const getYearOptions = (yearsBack = 5) => {
  const currentYear = new Date().getFullYear();
  const options = [];
  
  for (let i = 0; i <= yearsBack; i++) {
    const year = currentYear - i;
    options.push({
      label: String(year + 543), // โชว์ให้ผู้ใช้เห็นเป็น พ.ศ.
      value: String(year)        // แต่หลังบ้านเก็บค่าเป็น ค.ศ.
    });
  }
  return options;
};