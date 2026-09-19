import { useMemo } from "react";
import type { MenuItem } from "../config/menu";
import { getMenuByRole } from "../config/menu";
import { useAuth } from "../contexts/AuthContexts"; 

export function useMenu() {
  // ดึงค่า role จากระบบ Auth ส่วนกลาง แทนการดึงจาก localStorage ตรงๆ
  const { role } = useAuth(); 

  // ปรับตัวพิมพ์ใหญ่เพื่อความปลอดภัย เผื่อกรณีค่าเริ่มต้นเป็น null
  const userRole = (role || "").toUpperCase();

  // ใส่ userRole ในอาเรย์ความจำ [userRole] เมื่อ role เปลี่ยน ฟังก์ชันนี้จะทำงานใหม่ทันที!
  const allowedMenus = useMemo<MenuItem[]>(() => {
    return getMenuByRole(userRole);
  }, [userRole]);

  return {
    menuItems: allowedMenus,
    role: userRole,
    isAdminOrOwner: userRole === "OWNER" || userRole === "MANAGER" || userRole === "ADMIN",
    isManagerOrOwner: userRole === "OWNER" || userRole === "MANAGER" || userRole === "ADMIN"
  };
}