import { useMemo } from "react"; //จำค่า

// เอาไว้ใช้เป็น "ตัวเช็กสิทธิ์และบทบาทของผู้ใช้งาน" ทั่วทั้งระบบ
export const useUserRole = () => { // ไฟล์อื่นก็ import useUserRole() ได้เลย
  const userRole = useMemo(() => { // ใช้ตัวแปร userRole เพื่อเก็บค่า role ของผู้ใช้งาน โดยใช้ useMemo เพื่อจำค่าและไม่ให้คำนวณซ้ำทุกครั้งที่ component re-render
    if (typeof window === "undefined") return "EMPLOYEE"; // ถ้าอยู่ใน server-side (เช่น Next.js) ให้ return "EMPLOYEE" เป็นค่าเริ่มต้น
    return (localStorage.getItem("role") || "EMPLOYEE").toUpperCase(); // ถ้าอยู่ใน client-side ให้ดึงค่า role จาก localStorage ถ้าไม่มีให้ใช้ "EMPLOYEE" เป็นค่าเริ่มต้น และแปลงเป็นตัวพิมพ์ใหญ่
  }, []);

  const isOwnerOrManager = useMemo(() => { // ใช้ useMemo เพื่อจำค่า isOwnerOrManager และไม่ให้คำนวณซ้ำทุกครั้งที่ component re-render
    return ["OWNER", "MANAGER", "ADMIN"].includes(userRole); // ตรวจสอบว่า userRole เป็น "OWNER" หรือ "MANAGER" หรือไม่
  }, [userRole]); 

  return {
    userRole, // ส่งค่า userRole กลับไปให้ component ที่เรียกใช้
    isOwnerOrManager, // ส่งค่า isOwnerOrManager กลับไปให้ component ที่เรียกใช้
    isOwnerOrAdmin: isOwnerOrManager, // ส่งค่า isOwnerOrAdmin เพื่อรองรับ component เดิม
    isEmployee: userRole === "EMPLOYEE", // ส่งค่า Boolean เช็กสิทธิ์ว่าผู้ใช้รายนี้เป็นพนักงานทั่วไปใช่หรือไม่
  };
};