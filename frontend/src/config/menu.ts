import {
  LayoutDashboard, FileText, Boxes, MonitorSmartphone,
  ShoppingCart, FileClock, RefreshCw, Settings, FolderPlus, ArrowLeftRight 
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SubMenuItem {
  icon?: LucideIcon;
  label: string;
  path: string;
}

export interface MenuItem {
  icon: LucideIcon;
  label: string;
  path: string;
  roles: string[]; 
  subPath?: string;
  subLabel?: string;
  subIcon?: LucideIcon;
  subMenus?: SubMenuItem[];
}

export const SIDEBAR_MENUS: MenuItem[] = [
  // แดชบอร์ดของเจ้าของร้าน (ให้เห็นเฉพาะ OWNER, ADMIN)
  { 
    icon: LayoutDashboard, 
    label: "แดชบอร์ด", 
    path: "/owner/dashboard/", 
    roles: ["OWNER", "ADMIN"] 
  },
  
  // แดชบอร์ดของพนักงาน (ให้เห็นเฉพาะ EMPLOYEE, STAFF)
  { 
    icon: LayoutDashboard, 
    label: "แดชบอร์ด", 
    path: "/employee/dashboard", 
    roles: ["EMPLOYEE", "STAFF"] 
  },

  // เมนูอื่น ๆ ล็อกสิทธิ์ตามที่วางโครงสร้างไว้
  { icon: FileText, label: "นำเข้าสินค้าจากบิล", path: "/owner/import-bills", roles: ["OWNER", "ADMIN"] },
  { icon: Boxes, label: "คลังสินค้า", path: "/owner/stock", roles: ["OWNER", "ADMIN"], subIcon: ArrowLeftRight, subPath: "/owner/stock/stock-movement", subLabel: "การเคลื่อนไหวของคลังสินค้า" },
  { icon: FolderPlus, label:"สร้างข้อมูลสินค้า", path: "/owner/stock/stock-data", roles: ["OWNER", "ADMIN"] },
  { icon: MonitorSmartphone, label: "ระบบขาย POS", path: "/employee/pos", roles: ["OWNER", "ADMIN", "EMPLOYEE", "STAFF"] },
  { icon: ShoppingCart, label: "สั่งซื้อ", path: "/owner/orders", roles: ["OWNER", "ADMIN"] },
  { icon: ShoppingCart, label: "สั่งซื้อ", path: "/employee/orders", roles: ["EMPLOYEE"] },
  { icon: FileClock, label: "พรีออเดอร์", path: "/owner/pre-orders", roles: ["OWNER", "ADMIN", "EMPLOYEE", "STAFF"] },
  { 
    icon: RefreshCw, 
    label: "คืน และ เคลมสินค้า", 
    path: "/owner/claims", 
    roles: ["OWNER", "ADMIN", "EMPLOYEE", "STAFF"],
    subMenus: [
      { label: "รายการเคลมสินค้า", path: "/owner/claims", icon: FileText },
      { label: "รายการคืนสินค้า", path: "/owner/returns", icon: RefreshCw }
    ]
  },
  { 
    icon: Settings, 
    label: "การตั้งค่า", 
    path: "/owner/storeconfig", 
    roles: ["OWNER", "ADMIN"],
    subPath: "/owner/storeconfig",
    subLabel: "จัดการสิทธิ์ส่วนลดลูกค้าอู่"
  },
];

// ใครมีชื่อในอาเรย์ roles ของปุ่มนั้น ถึงจะโชว์บนหน้าจอ
export const getMenuByRole = (role: string): MenuItem[] => {
  const currentRole = role.toUpperCase();
  return SIDEBAR_MENUS.filter((menu) => menu.roles.includes(currentRole));
};