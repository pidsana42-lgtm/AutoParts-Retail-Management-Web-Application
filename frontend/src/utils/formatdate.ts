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